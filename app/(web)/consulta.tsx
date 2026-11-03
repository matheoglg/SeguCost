// W-18 Costos y precios vigentes (RF-39). Read-only lookup for billing and sales; no editing actions.
import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/TextField';
import { DataTable } from '@/components/web/DataTable';
import { Card, Note, Page } from '@/components/web/Page';
import { currentRecipe, standardCost } from '@/domain/costing';
import { productTypeLabels } from '@/domain/labels';
import { dateKey } from '@/domain/prices';
import { currentReferencePrice } from '@/domain/pricing';
import { formatDate, formatUnitCost } from '@/format';
import { useDataStore } from '@/store/data';

export default function PriceLookupScreen() {
  const db = useDataStore((s) => s.db);
  const [search, setSearch] = useState('');
  const now = new Date().toISOString();
  const q = search.trim().toLowerCase();

  const rows = db.products
    .filter((p) => p.active && `${p.code} ${p.name}`.toLowerCase().includes(q))
    .map((p) => {
      const recipe = currentRecipe(db, p.id);
      const inputs = recipe?.items.map((i) => i.materialId) ?? [];
      // The standard cost changes when a recipe is approved or a price of one of its materials changes.
      const costDate = [recipe?.decidedAt ? dateKey(recipe.decidedAt) : '', ...db.supplierPrices.filter((x) => inputs.includes(x.materialId) && x.validFrom <= dateKey(now)).map((x) => x.validFrom)].sort().at(-1);
      return { product: p, cost: standardCost(db, p.id, now).unitCost, price: currentReferencePrice(db.priceProposals, p.id), costDate };
    });

  return (
    <Page intro="Consulta de solo lectura del costo unitario estándar y del precio referencial aprobado de cada funda, para usarlos en Dobra.">
      <View style={{ maxWidth: 420 }}>
        <TextField label="Buscar por código o nombre" value={search} onChangeText={setSearch} placeholder="Ej.: FI-4060 o impresa" testID="lookup-search" />
      </View>
      <Card padded={false}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.product.id}
          emptyText="Ninguna funda coincide con la búsqueda."
          testID="lookup-table"
          columns={[
            { key: 'c', title: 'Código', flex: 0.7, render: (r) => r.product.code },
            { key: 'n', title: 'Funda', flex: 2, render: (r) => r.product.name },
            { key: 't', title: 'Tipo', flex: 0.6, render: (r) => productTypeLabels[r.product.type] },
            { key: 'cost', title: 'Costo unitario estándar', align: 'right', render: (r) => formatUnitCost(r.cost) },
            { key: 'price', title: 'Precio referencial', align: 'right', render: (r) => (r.price ? formatUnitCost(r.price.price) : 'Sin aprobar') },
            { key: 'cd', title: 'Costo actualizado', render: (r) => (r.costDate ? formatDate(r.costDate) : '—') },
            { key: 'pd', title: 'Precio aprobado', render: (r) => (r.price?.decidedAt ? formatDate(r.price.decidedAt) : '—') },
          ]}
        />
      </Card>
      <Note tone="info">Los valores se actualizan solos cuando cambia un precio de insumo, una receta o se aprueba un precio referencial.</Note>
    </Page>
  );
}
