-- =============================================================================
-- Stored Procedures del catálogo — RDS PostgreSQL (servicios, características, impuestos)
--
-- Requisitos de la rúbrica (Proyecto C) cubiertos aquí:
--    9. sp_bulk_assign_features   Asignación masiva de características a servicios
--   10. sp_update_service_price   Auditoría de cambios en tarifas de servicios
--                                 (+ trigger trg_service_price_audit y service_price_history)
--    +  sp_change_tax_rate        Programación de una nueva tasa de impuesto con historial
--    +  sp_sync_tax_rates         Activa las tasas cuya vigencia empieza hoy (EventBridge)
--    +  fn_tax_rate_on            Tasa vigente de un impuesto en una fecha
--
-- Errores de negocio: RAISE EXCEPTION (SQLSTATE P0001) con el mensaje que muestra el frontend.
-- Los procedimientos no hacen COMMIT: la transacción la controla quien llama.
-- Requiere database/postgres/03_rubrica_ext.sql. Se puede ejecutar varias veces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tasa vigente en una fecha: periodo con valid_from <= fecha < valid_to.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tax_rate_on(p_tax_id INTEGER, p_day DATE)
RETURNS NUMERIC(6,4)
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT h.rate FROM tax_history h
          WHERE h.tax_id = p_tax_id AND h.valid_from <= p_day
            AND (h.valid_to IS NULL OR p_day < h.valid_to)
          ORDER BY h.valid_from DESC LIMIT 1),
        (SELECT t.current_rate FROM tax t WHERE t.id = p_tax_id));
$$;

-- -----------------------------------------------------------------------------
-- Nueva tasa de impuesto a partir de p_valid_from (hoy o futuro).
-- Cierra el periodo abierto en p_valid_from y abre uno nuevo; si la vigencia ya
-- empezó, actualiza tax.current_rate. Bloquea el impuesto para evitar carreras.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_change_tax_rate(
    p_tax_id     INTEGER,
    p_rate       NUMERIC,
    p_valid_from DATE,
    p_user_id    INTEGER,
    INOUT p_current_rate NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_open_from DATE;
    v_today     DATE := (now() AT TIME ZONE 'utc')::DATE;
BEGIN
    PERFORM 1 FROM tax WHERE id = p_tax_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tax not found' USING ERRCODE = 'P0001';
    END IF;
    IF p_rate IS NULL OR p_rate < 0 OR p_rate > 1 THEN
        RAISE EXCEPTION 'Rate must be between 0%% and 100%%' USING ERRCODE = 'P0001';
    END IF;
    IF p_valid_from IS NULL OR p_valid_from < v_today THEN
        RAISE EXCEPTION 'The new rate cannot start in the past' USING ERRCODE = 'P0001';
    END IF;

    SELECT valid_from INTO v_open_from
      FROM tax_history WHERE tax_id = p_tax_id AND valid_to IS NULL;

    IF v_open_from IS NOT NULL THEN
        IF p_valid_from <= v_open_from THEN
            RAISE EXCEPTION 'The new rate must start after %', to_char(v_open_from, 'YYYY-MM-DD')
                USING ERRCODE = 'P0001';
        END IF;
        UPDATE tax_history SET valid_to = p_valid_from
         WHERE tax_id = p_tax_id AND valid_to IS NULL;
    END IF;

    INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
    VALUES (p_tax_id, p_rate, p_valid_from, NULL, p_user_id);

    UPDATE tax SET current_rate = fn_tax_rate_on(p_tax_id, v_today) WHERE id = p_tax_id;
    SELECT current_rate INTO p_current_rate FROM tax WHERE id = p_tax_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Sincroniza tax.current_rate con la tasa vigente a p_today. La ejecuta a diario
-- la Lambda tax_rate_sync (EventBridge). Devuelve cuántos impuestos cambiaron.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_sync_tax_rates(
    p_today DATE DEFAULT NULL,
    INOUT p_updated INTEGER DEFAULT 0
)
LANGUAGE plpgsql AS $$
DECLARE
    v_day DATE := COALESCE(p_today, (now() AT TIME ZONE 'utc')::DATE);
BEGIN
    UPDATE tax t
       SET current_rate = fn_tax_rate_on(t.id, v_day)
     WHERE t.current_rate IS DISTINCT FROM fn_tax_rate_on(t.id, v_day);
    GET DIAGNOSTICS p_updated = ROW_COUNT;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Cambio de tarifa auditado. Fija usuario y motivo en la sesión (solo para esta
-- transacción) y el trigger trg_service_price_audit escribe service_price_history.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_update_service_price(
    p_service_id INTEGER,
    p_new_price  NUMERIC,
    p_user_id    INTEGER,
    p_reason     VARCHAR DEFAULT NULL,
    INOUT p_history_id INTEGER DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_old NUMERIC(10,2);
BEGIN
    SELECT base_price INTO v_old FROM service WHERE id = p_service_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0001';
    END IF;
    IF p_new_price IS NULL OR p_new_price < 0 OR p_new_price > 99999999.99 THEN
        RAISE EXCEPTION 'Invalid price' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('app.user_id', COALESCE(p_user_id::TEXT, ''), true);
    PERFORM set_config('app.price_reason', COALESCE(LEFT(p_reason, 255), ''), true);

    UPDATE service SET base_price = ROUND(p_new_price, 2) WHERE id = p_service_id;

    SELECT id INTO p_history_id
      FROM service_price_history
     WHERE service_id = p_service_id
     ORDER BY id DESC LIMIT 1;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Asignación masiva: asigna cada característica de p_feature_ids a cada servicio
-- de p_service_ids con el valor p_value (upsert). Valida que todos los ids existan.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_bulk_assign_features(
    p_service_ids INTEGER[],
    p_feature_ids INTEGER[],
    p_value       VARCHAR,
    INOUT p_affected INTEGER DEFAULT 0
)
LANGUAGE plpgsql AS $$
DECLARE
    v_missing INTEGER;
BEGIN
    IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0
       OR p_feature_ids IS NULL OR cardinality(p_feature_ids) = 0 THEN
        RAISE EXCEPTION 'Select at least one service and one feature' USING ERRCODE = 'P0001';
    END IF;
    IF p_value IS NULL OR length(trim(p_value)) = 0 OR length(p_value) > 100 THEN
        RAISE EXCEPTION 'Invalid feature value' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_missing
      FROM unnest(p_service_ids) AS x(id)
     WHERE NOT EXISTS (SELECT 1 FROM service s WHERE s.id = x.id);
    IF v_missing > 0 THEN
        RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_missing
      FROM unnest(p_feature_ids) AS x(id)
     WHERE NOT EXISTS (SELECT 1 FROM feature f WHERE f.id = x.id);
    IF v_missing > 0 THEN
        RAISE EXCEPTION 'Feature not found' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO service_feature (service_id, feature_id, value)
    SELECT DISTINCT s.id, f.id, trim(p_value)
      FROM unnest(p_service_ids) AS s(id)
     CROSS JOIN unnest(p_feature_ids) AS f(id)
    ON CONFLICT (service_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    GET DIAGNOSTICS p_affected = ROW_COUNT;
END;
$$;
