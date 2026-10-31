import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { MoreHorizontal } from 'lucide-react';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '#components/ui/dropdown-menu';
import { StockBadge } from '#components/stock-badge';
import { useCatalogDemo } from './demo-context.js';
export default function CatalogPage() {
  const { t } = useTranslation();
  const { products } = useCatalogDemo();
  const [query, setQuery] = useState('');
  const location = useLocation();
  return (
    <PageContainer>
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.description')}
      />
      <DataTable
        data={products.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()),
        )}
        pagination={false}
        emptyMessage={t('catalog.noResults')}
        toolbar={() => (
          <Input
            className='max-w-sm'
            aria-label={t('catalog.search')}
            placeholder={t('catalog.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        columns={[
          {
            accessorKey: 'name',
            header: t('catalog.name'),
            cell: ({ row }) => (
              <Link
                className='font-medium hover:underline'
                to={{
                  pathname: `edit/${row.original.id}`,
                  search: location.search,
                }}
              >
                {row.original.name}
              </Link>
            ),
          },
          { accessorKey: 'sku', header: 'SKU' },
          { accessorKey: 'category', header: t('catalog.category') },
          {
            accessorKey: 'stock',
            header: t('catalog.availability'),
            cell: ({ row }) => <StockBadge stock={row.original.stock} />,
          },
          {
            id: 'actions',
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={t('catalog.rowActions', {
                        name: row.original.name,
                      })}
                    >
                      <MoreHorizontal />
                    </Button>
                  }
                />
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    render={
                      <Link
                        to={{
                          pathname: `edit/${row.original.id}`,
                          search: location.search,
                        }}
                      />
                    }
                  >
                    {t('catalog.edit')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
      <Outlet />
    </PageContainer>
  );
}
