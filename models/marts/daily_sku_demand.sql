select sku,sold_on,sum(quantity) as units_sold,sum(gross_sales) as gross_sales,count(*) as transactions
from {{ ref('stg_sales_transactions') }}
group by sku,sold_on
