-- Repair rooms that already took two packs sharing a name, before the importer
-- learned to rename. Keeps the earliest pack's name, suffixes the later ones,
-- matching what the importer now does at install time.
with ranked as (
  select e.id, e.name,
         row_number() over (partition by p.room_id, e.name order by p.created_at, e.name) rn
  from emoji e join packs p on p.id = e.pack_id
)
update emoji e
set name = r.name || '-' || r.rn
from ranked r
where e.id = r.id and r.rn > 1;
