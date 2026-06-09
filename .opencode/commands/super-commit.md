---
description: Agrupa cambios en commits semánticos y pushea
---

## descripción
Chequea que todo esté correctamente configurado.
Agrupa los cambios en commits semánticos.

Contexto opcional para los mensajes de commit: `$ARGUMENTS`

## Reglas

1 Inspeccionar el estado de todo el repositorio:
- `git status --short`
- `git diff --stat`
- `git diff`
- `git log --oneline -10`
2 Identifica los cambios relacionados y agrupalos por: feature, fix, refactor, test, docs, chore, release o config.
3 Crea múltiples commits cuándo los cambios sean independientes, no mezcles cambios no relacionados en un mismo commit.
4 Si `$ARGUMENTS` no es vacío, usa el contexto para ajustar el mensaje de los commits, pero no fuerces el testo si no describe los cambios.
5 Escribí mensajes de commit limpios y concisos 
6 Asegurate antes de commitear no estar enviando: tokens, variables de entorno, credenciales, keys o secrets, si aparece cualquiera de estas, consultá antes de continuar.
7 No reviertas cambios existentes.
8 No uses `--no--verify`
9 No uses force push
###

1 Muestra el commit propuesto en el plan con los archivos incluídos en cada commit.
2 Si la agupación es clara, continuá. Si hay ambigüedades, consultá antes de seguir.
3 Para cada grupo: 
- Agrega solo los archivos para cafa grupo con `git add <files>`
- Creá el commit con un mensaje semántico.
4 Una vez que todos los commits fueron creados corré: `git push`
