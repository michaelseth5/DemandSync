select
  external_id,
  upper(trim(sku)) as sku,
  sold_on::date as sold_on,
  quantity::integer as quantity,
  unit_price::numeric(18,2) as unit_price,
  quantity * unit_price as gross_sales,
  source
from {{ source('raw', 'sales_transactions') }}
where quantity > 0 and unit_price >= 0
