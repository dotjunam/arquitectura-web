/**
 * Reportes derivados del catalogo.
 *
 * Son de solo lectura y se calculan al vuelo sobre el estado actual del
 * repositorio: no hay tabla de reportes ni datos duplicados.
 */

import { productRepository } from '../repositories/product.repository.js';

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export const reportService = {
  /**
   * Salud del stock: el reporte que le sirve a quien compra.
   *
   * Mira tres cosas distintas, y la tercera es la que duele: un producto en
   * cero sin nada pedido no se repone solo.
   */
  stockHealth() {
    const products = productRepository.findAll();

    const belowReorderLevel = products.filter(
      (product) => product.unitsInStock < product.reorderLevel,
    );
    const outOfStock = products.filter((product) => product.unitsInStock === 0);
    const outOfStockWithoutOrder = outOfStock.filter((product) => product.unitsOnOrder === 0);
    const discontinuedWithStock = products.filter(
      (product) => product.discontinued && product.unitsInStock > 0,
    );

    const toSummary = (product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unitsInStock: product.unitsInStock,
      unitsOnOrder: product.unitsOnOrder,
      reorderLevel: product.reorderLevel,
      supplierName: product.supplierName,
    });

    return {
      summary: {
        totalProducts: products.length,
        belowReorderLevel: belowReorderLevel.length,
        outOfStock: outOfStock.length,
        outOfStockWithoutOrder: outOfStockWithoutOrder.length,
        discontinuedWithStock: discontinuedWithStock.length,
      },
      // Los criticos primero: los que estan en cero y ademas nadie pidio.
      critical: outOfStockWithoutOrder.map(toSummary).sort((a, b) => a.id - b.id),
      belowReorderLevel: belowReorderLevel.map(toSummary).sort((a, b) => a.id - b.id),
      discontinuedWithStock: discontinuedWithStock.map(toSummary).sort((a, b) => a.id - b.id),
    };
  },

  /**
   * Margen por categoria.
   *
   * Se calcula sobre los totales de la categoria, no como promedio de los
   * margenes individuales: un producto caro pesa mas que uno barato, y
   * promediar porcentajes le daria a los dos el mismo peso.
   */
  marginByCategory() {
    const products = productRepository.findAll();
    const groups = new Map();

    for (const product of products) {
      const group = groups.get(product.category) ?? {
        category: product.category,
        productCount: 0,
        totalListPrice: 0,
        totalStandardCost: 0,
      };
      group.productCount += 1;
      group.totalListPrice += product.listPrice;
      group.totalStandardCost += product.standardCost;
      groups.set(product.category, group);
    }

    const categories = [...groups.values()]
      .map((group) => ({
        category: group.category,
        productCount: group.productCount,
        totalListPrice: round(group.totalListPrice, 2),
        totalStandardCost: round(group.totalStandardCost, 2),
        marginPct:
          group.totalListPrice === 0
            ? 0
            : round(
                ((group.totalListPrice - group.totalStandardCost) / group.totalListPrice) * 100,
              ),
      }))
      .sort((a, b) => b.marginPct - a.marginPct);

    const totalListPrice = products.reduce((sum, product) => sum + product.listPrice, 0);
    const totalStandardCost = products.reduce((sum, product) => sum + product.standardCost, 0);

    return {
      summary: {
        totalProducts: products.length,
        categories: categories.length,
        overallMarginPct:
          totalListPrice === 0
            ? 0
            : round(((totalListPrice - totalStandardCost) / totalListPrice) * 100),
      },
      categories,
    };
  },
};
