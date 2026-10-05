# Project architecture decisions

- The sidebar groups all dashboard destinations under the first “Dashboards” section so overview pages remain easy to find.
- PDI is fully retired; application code must not query or link its former tables or route.
- Financial closure reports are stored as immutable import snapshots so management summaries remain traceable to each uploaded workbook.
