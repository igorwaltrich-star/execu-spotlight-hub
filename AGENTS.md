# Project architecture decisions

- The sidebar groups all dashboard destinations under the first “Dashboards” section so overview pages remain easy to find.
- PDI is fully retired; application code must not query or link its former tables or route.
- Financial closure reports are stored as immutable import snapshots so management summaries remain traceable to each uploaded workbook.
- Sigra closure CSVs carry no summary, so their per-center totals are estimated from the previous import; imports from .csv files are flagged as estimated in the UI.
- Hub adoption and onboarding files are stored as immutable import snapshots, readable only by gestor, coordenador and supervisor because they name collaborators.
- Banco de Horas and Gestão Financeira screens are retired; their tables stay in the database, but no route or menu item links them.
- A supervisor may delete only their own closure import within one hour, so a failed import can be rolled back without making snapshots mutable.
- Pending Hub schema types are isolated in a feature-local client extension of the existing authenticated client; generated database types remain untouched until the migration is applied.
