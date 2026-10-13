-- Pone un hash bcrypt real (contraseña demo1234) a los usuarios que aún tienen el marcador del seed.
-- Después de esto el login funciona con ALLOW_DEMO_LOGIN=false (el valor seguro por defecto).
-- Cambia las contraseñas reales desde la aplicación; este script solo es para entornos de demo.
UPDATE app_user
   SET password_hash = '$2b$10$7anZ487mREnSU.gkB5JnLOZLFQ1oC/zMeh6VpO/JashaXbXbnUuP.'
 WHERE password_hash NOT LIKE '$2%' OR CHAR_LENGTH(password_hash) <> 60;
