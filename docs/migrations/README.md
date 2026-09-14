# Migraciones históricas — NO EJECUTAR

**Estado: obsoleto desde el 8 de agosto de 2026.**

Los 16 archivos de este directorio (`001_` … `016_`) documentaban a mano el esquema
mientras el proyecto se construía con Lovable. Nunca fueron el historial real: se
escribieron *después* de aplicar los cambios, y varios lo admiten en sus propias
cabeceras (`014_finance_module.sql`: *"Documentational migration — schema already
applied directly in Supabase"*).

Además estaban incompletos y en algunos puntos desactualizados. El ejemplo más claro
es `001_astratta_core_schema.sql`, cuya definición de `tasks` no incluye columnas que
la tabla real lleva desde julio: `lead_id`, `parent_task_id`, `type`, `tags`,
`estimated_hours`, `timer_started_at`, `timer_started_by`, `contract_id`,
`content_subtask_key`.

## Dónde está el historial real

En **[`supabase/migrations/`](../../supabase/migrations/)**: las 58 migraciones que
realmente se aplicaron en producción, recuperadas verbatim desde
`supabase_migrations.schema_migrations`, con su versión y nombre originales. Ese
directorio es el que reconoce la CLI de Supabase y el único que debe modificarse.

Se conserva este directorio solo como referencia arqueológica —los comentarios
explican decisiones de diseño que siguen siendo válidas—, pero **ejecutar estos
archivos contra cualquier base de datos rompería el esquema**.

## Dos migraciones no son reproducibles tal cual

Al recuperar el historial se detectaron dos archivos con el UUID del workspace de
Astratta incrustado, que fallarían en un entorno nuevo por clave foránea:

- `20260701193458_project_templates_seed_defaults.sql`
- `20260701195622_contracts_seed_clauses_and_templates.sql`

Ambos llevan una nota en cabecera. Cuando se implemente el alta autoservicio de
agencias, esas plantillas deberían sembrarse desde el trigger de creación de
workspace, no desde una migración con un identificador fijo. En el caso de los
contratos hay además una atadura legal: las cláusulas se rigen por las leyes de
Texas, y cada agencia necesitará su propia jurisdicción.

## Un secreto redactado

`20260702164057_google_calendar_sync_secret_vault.sql` contenía el valor literal del
secreto compartido entre `pg_cron` y la edge function de sincronización. Se redactó
al versionarlo para no dejarlo en el historial de git; el archivo explica cómo
regenerarlo. El secreto usado en producción sigue activo y conviene rotarlo.
