# Changes since the QR blast

The blast went out on **21 September 2026** — 431 emails covering 608 people.
Anything changed after that means somebody holds a code that is wrong, or holds
none at all. This is the running list, so the re-sends can be built from it
rather than from memory.

To build a sheet for any of these:

```
npx convex export --path /tmp/snap --prod
mkdir -p /tmp/snapd && unzip -oq /tmp/snap -d /tmp/snapd
node --experimental-strip-types scripts/resend.ts /tmp/snapd CG26-00071 GF26-00018 > /tmp/resend.csv
```

It takes registration numbers or addresses and works out which inboxes actually
carry those people's codes.

## Substitutions

The seat stays, the money stays, the workshop slot stays. The person changes,
and their personal details are cleared rather than inherited.

| Date | Registration | Out | In | Room | Code now goes to | Re-sent |
| --- | --- | --- | --- | --- | --- | --- |
| 21 Sep | CG26-00085 | Eduardo E. Orozco | Alfredo Young Jr | Worship Hall | arlizyoung@gmail.com | no |
| 21 Sep | CG26-00085 | Glorina P. Orozco | Arliz Young | YDT Room | arlizyoung@gmail.com | no |
| 24 Sep | CG26-00071 | Allan Gonzales | Rudy Monterey | 2nd Floor Lobby | ellenmaegonzales@gmail.com | no |
| 24 Sep | CG26-00071 | Amador Gonzales, Jr | Alfred Mar | YDT Room | ellenmaegonzales@gmail.com | no |
| 24 Sep | CG26-00071 | Teresita Gonzales | Jackie Mar | YDT Room | ellenmaegonzales@gmail.com | no |

### Asked for, not yet applied

Christina Buan of Pilar Village Gospel Church (CG26-00047) asked by email on
22 and 23 September:

- Irene Arunan → Teofila Bongato
- Nancy Pagalilawan → Esperanza Buena Mazon

## Addresses repaired

Every one of these was a real typo that made the address undeliverable, so the
original send went nowhere.

| Date | Person | Was | Now | Re-sent |
| --- | --- | --- | --- | --- |
| 21 Sep | Alma Gicana | almagicana20gmail.com | almagicana20@gmail.com | sent, **failed again** |
| 22 Sep | Raphaelle Mavi Arriola | …@gmail.con | …@gmail.com | yes |
| 22 Sep | Maritess Cudiamat, Maribel Villamor | jeydahbel11@gmail.cok | …@gmail.com | yes |
| 22 Sep | Rhealiza C. Apolinar | rcapolinar28@gmail.com. | …@gmail.com | yes |
| 23 Sep | Bernie Mallari | …@gmil.com (a typosquat, was receiving his mail) | …@gmail.com | no |
| 23 Sep | Walderico Rodriguez Berras | …@yahooo.com (null MX) | …@yahoo.com | no |
| 24 Sep | Jonamie Mosquera | arnelallanhoen@gmail.com | arnelallanhorn@gmail.com | no |
| 24 Sep | Tresilyn Alipio | iflicdmia@gmail.com | iflicdmia21@gmail.com | no |
| 24 Sep | Esperanza Felix | eipse_0328@yahoo.com | eipse_0328@yahoo.com.**ph** | no |

Alma Gicana's is the one to be honest about: the missing `@` was reconstructed,
the result was delivered to nobody, and she still has no working address. She
needs a printed pass from `/passes/GF26-00018`.

## Contacts repointed

| Date | Registration | Was | Now |
| --- | --- | --- | --- |
| 23 Sep | CG26-00143 (CMGO Fellowship) | alexicanamo@gmail.com | ibespineli@gmail.com |

## Still unreachable

Fourteen people whose address failed and has no correction. They need a printed
pass, or to be found by surname at the door — which works fine.

John Michael Alagos · Ruwinner Delos Reyes · Sonia Ochoa · Robert Lijauco ·
Lalaine Iringan · Alma Gicana · Lelanie Sayaman · Cristina Lopez ·
Maria Rouella Rosa · Rosemarie Dechosa · Liza Hernandez · Joseph Saniel ·
Domingo Ariola · Mary Joy Nanoy

Two patterns worth one more try: both `@phl.salvationarmy.org` addresses failed
together, which smells like a corporate mail server refusing bulk mail rather
than two bad addresses; and Domingo Ariola's inbox is simply full, which he can
clear himself.

## Groups merged

Cosmetic for the door, but it changes what the sheet and the Groups tab show.

| Date | Group | Registrations | People |
| --- | --- | --- | --- |
| 24 Sep | HarvestPoint Ministries — was spelled 8 ways | 14 | 27 |
| 24 Sep | God is Able — was held together by a group key | 18 | 36 |

Renaming a group rewrites the church of anyone whose church matched the old
group name. That took "IFL" off nine people and had to be put back with
`organizer:setChurchAs`. Check the `churchesUpdated` count after every rename.
