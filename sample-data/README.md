# Scheduloop CSV examples

Scheduloop needs a time column plus at least one demand column.

Basic format:

```csv
timestamp,orders,staff
2026-04-01 08:00:00,19,1
```

Better cafe format:

```csv
timestamp,drink_orders,food_orders,customers,staff
2026-04-01 08:00:00,12,7,18,2
```

Better gym format:

```csv
timestamp,check_ins,class_bookings,pt_bookings,staff
2026-04-01 08:00:00,45,12,3,4
```

Richer files let Scheduloop match demand to roles, for example baristas to
`drink_orders`, kitchen staff to `food_orders`, and front desk staff to
`check_ins`.
