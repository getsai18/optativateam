-- =============================================================================
-- Datos sintéticos de facturación (RDS MySQL). GENERADO por database/seed/generate_seed.py
-- 40 clientes y reglas de descuento por cliente. Idempotente.
-- =============================================================================

INSERT INTO customer (name, tax_id, email, phone, address, active) VALUES
    ('Aurora Textiles S.A. de C.V.', 'ATX140826A0A', 'facturacion@aurora0.example', '+52 235 881 5857', 'Paseo Montejo 733, Ciudad de México, CDMX', 1),
    ('Bosque Verde Alimentos S.A. de C.V.', 'BVA990621B1H', 'facturacion@bosque1.example', '+52 992 835 7629', 'Paseo Montejo 2564, Tijuana, B.C.', 1),
    ('Cumbre Ingeniería S.C.', 'CIX950814C2O', 'facturacion@cumbre2.example', '+52 227 983 6401', 'Av. Insurgentes Sur 374, Querétaro, Qro.', 1),
    ('Dinamo Energía S.A.P.I. de C.V.', 'DEX220828D3V', 'facturacion@dinamo3.example', '+52 059 458 5855', 'Blvd. Kukulcán 1360, Puebla, Pue.', 1),
    ('Eje Norte Transportes S.A. de C.V.', 'ENT991002E4C', 'facturacion@eje4.example', '+52 575 653 1238', 'Av. Insurgentes Sur 1622, Toluca, Edo. Méx.', 1),
    ('Faro Seguros S.A.', 'FSX961001F5J', 'facturacion@faro5.example', '+52 761 281 2179', 'Calz. de Tlalpan 2715, Tijuana, B.C.', 1),
    ('Granito Construcciones S.A. de C.V.', 'GCX060211G6Q', 'facturacion@granito6.example', '+52 575 366 7209', 'Av. Vallarta 3191, Monterrey, N.L.', 1),
    ('Horizonte Farmacéutica S.A. de C.V.', 'HFX950121H7X', 'facturacion@horizonte7.example', '+52 928 531 8932', 'Blvd. Díaz Ordaz 2746, Querétaro, Qro.', 1),
    ('Ícaro Aeroservicios S.A. de C.V.', 'IAX970724I8E', 'facturacion@icaro8.example', '+52 802 146 5602', 'Blvd. Kukulcán 3886, Querétaro, Qro.', 1),
    ('Jade Hoteles S.A. de C.V.', 'JHX121119J9L', 'facturacion@jade9.example', '+52 140 293 9730', 'Av. Juárez 3479, Querétaro, Qro.', 1),
    ('Kappa Laboratorios S.C.', 'KLX980607K0S', 'facturacion@kappa10.example', '+52 308 859 4130', 'Blvd. Kukulcán 754, Tijuana, B.C.', 1),
    ('Lumen Iluminación S.A. de C.V.', 'LIX960701L1Z', 'facturacion@lumen11.example', '+52 099 340 6492', 'Calz. de Tlalpan 1055, Cuernavaca, Mor.', 1),
    ('Marea Pesquera S. de R.L.', 'MPX000924M2G', 'facturacion@marea12.example', '+52 194 370 2821', 'Paseo Montejo 1672, Toluca, Edo. Méx.', 1),
    ('Nube Azul Telecom S.A.P.I. de C.V.', 'NAT980902N3N', 'facturacion@nube13.example', '+52 237 728 6402', 'Av. Vallarta 3232, Ciudad de México, CDMX', 1),
    ('Olivo Restaurantes S.A. de C.V.', 'ORX961204O4U', 'facturacion@olivo14.example', '+52 723 630 6304', 'Av. Constitución 1083, Ciudad de México, CDMX', 1),
    ('Pinar Muebles S.A. de C.V.', 'PMX030926P5B', 'facturacion@pinar15.example', '+52 217 441 6864', 'Av. Vallarta 2877, Toluca, Edo. Méx.', 1),
    ('Quetzal Turismo S.A. de C.V.', 'QTX950903Q6I', 'facturacion@quetzal16.example', '+52 925 645 3264', 'Blvd. Kukulcán 3899, Puebla, Pue.', 1),
    ('Roble Despacho Contable S.C.', 'RDC951013R7P', 'facturacion@roble17.example', '+52 494 505 2410', 'Blvd. Díaz Ordaz 3226, Querétaro, Qro.', 1),
    ('Sierra Minera S.A.B. de C.V.', 'SMX080806S8W', 'facturacion@sierra18.example', '+52 935 916 3146', 'Calz. de Tlalpan 3912, Monterrey, N.L.', 1),
    ('Trébol Agroindustrial S.P.R. de R.L.', 'TAX990422T9D', 'facturacion@trebol19.example', '+52 540 767 8388', 'Av. Universidad 2451, Monterrey, N.L.', 1),
    ('Umbral Arquitectos S.C.', 'UAX971007U0K', 'facturacion@umbral20.example', '+52 162 596 7119', 'Av. Revolución 3477, Tijuana, B.C.', 1),
    ('Vértice Automotriz S.A. de C.V.', 'VAX080221V1R', 'facturacion@vertice21.example', '+52 828 141 6393', 'Blvd. Díaz Ordaz 1275, Toluca, Edo. Méx.', 1),
    ('Wari Cosméticos S.A. de C.V.', 'WCX950115W2Y', 'facturacion@wari22.example', '+52 335 979 3598', 'Av. Constitución 2490, Monterrey, N.L.', 1),
    ('Xólotl Editorial S.A. de C.V.', 'XEX980505X3F', 'facturacion@xolotl23.example', '+52 714 236 4958', 'Blvd. Kukulcán 1604, Tijuana, B.C.', 1),
    ('Yunque Metalúrgica S.A. de C.V.', 'YMX081101Y4M', 'facturacion@yunque24.example', '+52 341 789 4444', 'Av. Constitución 247, Toluca, Edo. Méx.', 1),
    ('Zafiro Joyería S.A. de C.V.', 'ZJX960728Z5T', 'facturacion@zafiro25.example', '+52 638 196 7752', 'Av. Universidad 1156, Tijuana, B.C.', 1),
    ('Altamira Hospital S.A. de C.V.', 'AHX960119A6A', 'facturacion@altamira26.example', '+52 427 576 6924', 'Av. Universidad 2289, Cuernavaca, Mor.', 1),
    ('Brisa Inmobiliaria S.A. de C.V.', 'BIX041107B7H', 'facturacion@brisa27.example', '+52 895 105 6399', 'Av. Vallarta 1839, Guadalajara, Jal.', 1),
    ('Cauce Hidráulica S.A. de C.V.', 'CHX950926C8O', 'facturacion@cauce28.example', '+52 781 264 4351', 'Av. Constitución 3710, Querétaro, Qro.', 1),
    ('Delfín Logística Marítima S.A. de C.V.', 'DLM980915D9V', 'facturacion@delfin29.example', '+52 425 855 5270', 'Blvd. Díaz Ordaz 1525, Toluca, Edo. Méx.', 1),
    ('Encino Universidad A.C.', 'EUX070524E0C', 'facturacion@encino30.example', '+52 554 337 1337', 'Blvd. Díaz Ordaz 3275, Monterrey, N.L.', 1),
    ('Fénix Reciclaje S.A. de C.V.', 'FRX990924F1J', 'facturacion@fenix31.example', '+52 048 550 4258', 'Av. Revolución 396, Monterrey, N.L.', 1),
    ('Girasol Guarderías S.C.', 'GGX961206G2Q', 'facturacion@girasol32.example', '+52 633 454 8008', 'Av. Universidad 2871, Monterrey, N.L.', 1),
    ('Halcón Seguridad Privada S.A. de C.V.', 'HSP091127H3X', 'facturacion@halcon33.example', '+52 326 468 3936', 'Av. Constitución 1755, Cuernavaca, Mor.', 1),
    ('Iris Óptica S.A. de C.V.', 'IOX970703I4E', 'facturacion@iris34.example', '+52 426 921 2503', 'Calz. de Tlalpan 2028, Ciudad de México, CDMX', 1),
    ('Jaguar Deportes S.A. de C.V.', 'JDX991021J5L', 'facturacion@jaguar35.example', '+52 560 715 1633', 'Av. Vallarta 3787, Guadalajara, Jal.', 1),
    ('Kiosko Digital S.A.P.I. de C.V.', 'KDX090612K6S', 'facturacion@kiosko36.example', '+52 804 800 9917', 'Blvd. Kukulcán 1589, Monterrey, N.L.', 1),
    ('Laguna Bebidas S.A. de C.V.', 'LBX961028L7Z', 'facturacion@laguna37.example', '+52 207 870 9014', 'Av. Vallarta 2620, León, Gto.', 1),
    ('Monarca Fundación A.C.', 'MFX980802M8G', 'facturacion@monarca38.example', '+52 276 474 4480', 'Av. Vallarta 3267, Monterrey, N.L.', 1),
    ('Nogal Abogados S.C.', 'NAX080602N9N', 'facturacion@nogal39.example', '+52 585 915 8850', 'Paseo Montejo 409, Ciudad de México, CDMX', 1)
ON DUPLICATE KEY UPDATE id = id;

-- Descuentos por cliente (además de las reglas de volumen de 03_rubrica_ext.sql)
INSERT INTO discount_rule (name, customer_id, min_subtotal, pct)
SELECT v.name, c.id, v.min_subtotal, v.pct
  FROM (
        SELECT 'Convenio educativo' AS name, 'EUX070524E0C' AS tax_id, NULL AS min_subtotal, 0.0800 AS pct
        UNION ALL SELECT 'Cliente estratégico', 'DEX220828D3V', 20000.00, 0.0600
        UNION ALL SELECT 'Fundación sin fines de lucro', 'MFX980802M8G', NULL, 0.1000
  ) v
  JOIN customer c ON c.tax_id = v.tax_id
 WHERE NOT EXISTS (SELECT 1 FROM discount_rule d WHERE d.name = v.name);
