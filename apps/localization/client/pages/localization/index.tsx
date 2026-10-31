import { useCallback, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Languages } from 'lucide-react';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import { useSyncServerLocale } from '@nocobase/app-plugin-i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '#components/ui/dropdown-menu';
import { LanguageSwitcher } from '../../layouts/components/language-switcher.js';
import {
  products as initialProducts,
  type Product,
  type CatalogContext,
} from './data.js';
import { productFormatters } from './format.js';

export default function CatalogPage() {
  const { t } = useTranslation();
  const { t: pluginT } = useTranslation('@nocobase/app-plugin-i18n');
  const { locale } = useLocale();
  // Optional/public pages are outside AppLayout, which normally owns this call.
  useSyncServerLocale();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState(initialProducts);
  const save = useCallback((id: string, name: string) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, name } : product,
      ),
    );
  }, []);
  const context = useMemo<CatalogContext>(
    () => ({ products, save }),
    [products, save],
  );
  const visible = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()),
  );
  const format = productFormatters(locale);
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: t('catalog.name'),
      cell: ({ row }) => (
        <RecordLink
          to={{ pathname: `edit/${row.original.id}`, search: location.search }}
        >
          {row.original.name}
        </RecordLink>
      ),
    },
    {
      accessorKey: 'price',
      header: () => <div className='text-right'>{t('catalog.price')}</div>,
      cell: ({ row }) => (
        <div className='text-right tabular-nums'>
          {format.money.format(row.original.price)}
        </div>
      ),
    },
    {
      accessorKey: 'stock',
      header: () => <div className='text-right'>{t('catalog.stock')}</div>,
      cell: ({ row }) => (
        <div className='text-right tabular-nums'>
          {format.number.format(row.original.stock)}
        </div>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: `${t('catalog.updated')} (UTC)`,
      cell: ({ row }) => format.date.format(new Date(row.original.updatedAt)),
    },
  ];
  return (
    <PageContainer className='mx-auto max-w-6xl'>
      <nav>
        <Link className='text-sm font-medium' to='/localization'>
          {t('navigation.catalog')}
        </Link>
      </nav>
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.description')}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='outline' />}>
              <Languages />
              {t('catalog.language')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-56'>
              <LanguageSwitcher />
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='grid w-full gap-2 sm:w-72'>
          <Label htmlFor='catalog-search'>{t('catalog.search')}</Label>
          <Input
            id='catalog-search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p role='status' className='text-sm text-muted-foreground'>
          {t('catalog.count', { count: visible.length })}
        </p>
      </div>
      <DataTable
        columns={columns}
        data={visible}
        pagination={false}
        emptyMessage={t('catalog.empty')}
      />
      <section
        aria-label={t('catalog.examples')}
        className='grid gap-4 md:grid-cols-2'
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.fallbackTitle')}</CardTitle>
            <CardDescription>{t('catalog.fallbackHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid='shipping'>{t('catalog.shipping')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.pluginTitle')}</CardTitle>
            <CardDescription>{t('catalog.pluginHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid='plugin-label'>{pluginT('language.label')}</p>
          </CardContent>
        </Card>
      </section>
      <p className='text-sm text-muted-foreground'>
        {t('catalog.currentLocale', { locale })}
      </p>
      <Outlet context={context} />
    </PageContainer>
  );
}
