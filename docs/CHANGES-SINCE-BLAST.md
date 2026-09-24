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
| 24 Sep | CG26-00047 | Irene Arunan | Teofila Bongato | Worship Hall | reyierose@gmail.com | no |
| 24 Sep | CG26-00047 | Nancy Pagalilawan | Esperanza Buena Mazon | Worship Hall | reyierose@gmail.com | no |
| 24 Sep | GF26-00065 | Norberto Torrefranca III | Melanie Gutierrez | Worship Hall | garciagraceann@gmail.com | no |
| 24 Sep | GF26-00064 | Pamela Torrefranca | Grace Cua | Worship Hall | garciagraceann@gmail.com | no |
| 24 Sep | GF26-00053 | Jeanette Nano | Linda Villoria | Worship Hall | garciagraceann@gmail.com | no |
| 24 Sep | CG26-00063 | Nehemias Martin | Merlyn Guillermo | Worship Hall | merlyn_guillermo@yahoo.com | no |
| 24 Sep | CG26-00034 | James M. Lumanog | Roselle Santander | YDT Room | sisleili2020@gmail.com | no |
| 24 Sep | CG26-00139 | Ivee Abenojar | Jemie Joy LaPastora | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Mark Nepacina | Gian Andrew Gutierrez | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Zhein Ronquillo | Kyle Gutierrez | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Esther Nicole Lladones | Jovita Lladones | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | BJoy Nepacina | Carl John Ronquillo | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Jerayah Kiel Jovellanos | Love Treasure Ronquillo | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | French Emerald Cruz | Almer Hernandez | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Melchor Bermas | Aimee Joy Hernandez | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Clouie Cruz | Jokiebed Lim | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Evelyn Campo | Levi Tia | Worship Hall | sgualberto@icloud.com | no |
| 24 Sep | CG26-00139 | Dominique Deoso | Raizene Alvarado | Worship Hall | sgualberto@icloud.com | no |

Both PVGC ones were requested by Christina Buan by email on 22 and 23
September. Neither substitute has an address of their own, so their codes go to
Christina — which is what she asked for.

### "Nemy Martin" was read as Nehemias, not Myrna

The sheet said "Nemy Martin" and CG26-00063 holds two: Nehemias and Myrna, both
session 1, both on myrnasmartin@gmail.com. Nehemias was taken as the match on
the strength of the nickname. If that is wrong, Myrna is the one to swap and
Nehemias goes back as:

```
age 68 · Female · Married · Pastor · Life at I am Redeemer and Master
Evangelical Church · Marikina · 09178530165 · myrnasmartin@gmail.com
```

Myrna, untouched, is: age 67 · Female · Married · Housewife · Life group leader
· Marikina · 09173201574 · myrnasmartin@gmail.com.

### The Friends of Jesus Christ sheet

Six names in two columns with no pairing given, and three of them already on
the registration. Only one row was a real change: James Lumanog out, Roselle
Santander in. Charissa and Rossman Dado were already registered, so those two
rows recorded something that had already happened.

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
| 24 Sep | GF26-00065, GF26-00064, GF26-00053 | each outgoing person's own address | garciagraceann@gmail.com |
| 24 Sep | CG26-00139 (Church of the Nazarene GMA) | alexicanamo@gmail.com | sgualberto@icloud.com |

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
