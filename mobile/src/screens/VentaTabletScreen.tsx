import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

export interface ProductItem {
  id: string;
  nombre: string;
  precio: number;
  tipoVenta: 'peso' | 'unidad';
  unidadMedida?: 'kg' | 'g' | 'unidad';
  categoria: string;
  codigoBarras?: string;
}

export interface TicketItem {
  id: string;
  productoId: string;
  nombre: string;
  tipoVenta: 'peso' | 'unidad';
  unidadMedida: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface CompletedSale {
  items: TicketItem[];
  total: number;
  efectivo: number;
  cambio: number;
  metodoPago: string;
  timestamp: number;
}

export interface VentaTabletScreenProps {
  offlineMode?: boolean;
  pendingOutboxCount?: number;
  liveWeight?: number;
  isScaleStable?: boolean;
  cashierName?: string;
  storeName?: string;
  products?: ProductItem[];
  categories?: string[];
  onCobrar?: (sale: CompletedSale) => void;
  onTare?: () => void;
  onZero?: () => void;
}

export const DEFAULT_CATEGORIES: string[] = [
  'Todos',
  'Res',
  'Cerdo',
  'Pollo',
  'Vísceras',
];

export const DEFAULT_PRODUCTS: ProductItem[] = [
  // Res
  { id: 'prod-res-01', nombre: 'Lomo Fino de Res', precio: 38000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  { id: 'prod-res-02', nombre: 'Costilla de Res', precio: 22000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  { id: 'prod-res-03', nombre: 'Punta de Anca', precio: 36000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  { id: 'prod-res-04', nombre: 'Cadera de Res', precio: 32000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  { id: 'prod-res-05', nombre: 'Sobrebarriga Gruesa', precio: 26000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  { id: 'prod-res-06', nombre: 'Carne Molida Especial', precio: 24000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Res' },
  // Cerdo
  { id: 'prod-cer-01', nombre: 'Costilla de Cerdo', precio: 24500, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Cerdo' },
  { id: 'prod-cer-02', nombre: 'Lomo de Cerdo', precio: 22000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Cerdo' },
  { id: 'prod-cer-03', nombre: 'Tocino Barriguero', precio: 18000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Cerdo' },
  { id: 'prod-cer-04', nombre: 'Chuleta de Cerdo', precio: 20000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Cerdo' },
  { id: 'prod-cer-05', nombre: 'Chorizo Casero (Unid)', precio: 3500, tipoVenta: 'unidad', unidadMedida: 'unidad', categoria: 'Cerdo' },
  // Pollo
  { id: 'prod-pol-01', nombre: 'Pechuga Entera', precio: 18000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Pollo' },
  { id: 'prod-pol-02', nombre: 'Muslos de Pollo', precio: 12500, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Pollo' },
  { id: 'prod-pol-03', nombre: 'Alas de Pollo', precio: 14000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Pollo' },
  { id: 'prod-pol-04', nombre: 'Menudencias de Pollo', precio: 6500, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Pollo' },
  // Vísceras
  { id: 'prod-vis-01', nombre: 'Hígado de Res', precio: 12000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Vísceras' },
  { id: 'prod-vis-02', nombre: 'Mondongo / Callo', precio: 14000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Vísceras' },
  { id: 'prod-vis-03', nombre: 'Bofe de Res', precio: 8000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Vísceras' },
  { id: 'prod-vis-04', nombre: 'Corazón de Res', precio: 11000, tipoVenta: 'peso', unidadMedida: 'kg', categoria: 'Vísceras' },
];

export const FAST_CASH_DENOMINATIONS: number[] = [10000, 20000, 50000, 100000];

export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(3)} kg`;
}

export const VentaTabletScreen: React.FC<VentaTabletScreenProps> = ({
  offlineMode = false,
  pendingOutboxCount = 0,
  liveWeight = 2.450,
  isScaleStable = true,
  cashierName = 'Cajero de Turno',
  storeName = 'SystemPOS Carnicería Central',
  products = DEFAULT_PRODUCTS,
  categories = DEFAULT_CATEGORIES,
  onCobrar,
  onTare,
  onZero,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [efectivoRecibido, setEfectivoRecibido] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Todos') {
      return products;
    }
    return products.filter((p) => p.categoria === selectedCategory);
  }, [products, selectedCategory]);

  // Grand Total calculation
  const granTotal = useMemo(() => {
    return ticketItems.reduce((acc, item) => acc + item.subtotal, 0);
  }, [ticketItems]);

  // Instant Change calculation
  const cambio = useMemo(() => {
    return Math.max(0, efectivoRecibido - granTotal);
  }, [efectivoRecibido, granTotal]);

  const faltante = useMemo(() => {
    return Math.max(0, granTotal - efectivoRecibido);
  }, [efectivoRecibido, granTotal]);

  // Add product to ticket
  const handleSelectProduct = (product: ProductItem) => {
    setStatusMessage(null);

    if (product.tipoVenta === 'peso') {
      if (liveWeight <= 0) {
        setStatusMessage('Coloque el corte en la báscula (peso debe ser mayor a 0.000 kg)');
        return;
      }
      const weight = Number(liveWeight.toFixed(3));
      const subtotal = Math.round(product.precio * weight);
      const newItem: TicketItem = {
        id: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productoId: product.id,
        nombre: product.nombre,
        tipoVenta: 'peso',
        unidadMedida: product.unidadMedida || 'kg',
        precioUnitario: product.precio,
        cantidad: weight,
        subtotal,
      };
      setTicketItems((prev) => [newItem, ...prev]);
    } else {
      // Sold by unit
      const newItem: TicketItem = {
        id: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productoId: product.id,
        nombre: product.nombre,
        tipoVenta: 'unidad',
        unidadMedida: 'unid',
        precioUnitario: product.precio,
        cantidad: 1,
        subtotal: product.precio,
      };
      setTicketItems((prev) => [newItem, ...prev]);
    }
  };

  // Remove item from ticket
  const handleRemoveItem = (id: string) => {
    setTicketItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear entire ticket
  const handleClearTicket = () => {
    setTicketItems([]);
    setEfectivoRecibido(0);
    setStatusMessage(null);
  };

  // Cash shortcuts
  const handleFastCash = (amount: number) => {
    setEfectivoRecibido((prev) => prev + amount);
  };

  const handleExactCash = () => {
    setEfectivoRecibido(granTotal);
  };

  const handleClearCash = () => {
    setEfectivoRecibido(0);
  };

  // Checkout action
  const handleCheckout = () => {
    if (ticketItems.length === 0) {
      setStatusMessage('La comanda está vacía. Seleccione productos para cobrar.');
      return;
    }

    if (efectivoRecibido < granTotal) {
      setStatusMessage(`Efectivo insuficiente. Faltan ${formatCOP(faltante)}`);
      return;
    }

    const sale: CompletedSale = {
      items: [...ticketItems],
      total: granTotal,
      efectivo: efectivoRecibido,
      cambio,
      metodoPago: 'efectivo',
      timestamp: Date.now(),
    };

    if (onCobrar) {
      onCobrar(sale);
    }

    // Reset ticket for next transaction
    setTicketItems([]);
    setEfectivoRecibido(0);
    setStatusMessage('¡Venta cobrada e impresión de ticket enviada con éxito!');
  };

  const isCheckoutDisabled = ticketItems.length === 0 || efectivoRecibido < granTotal;

  return (
    <View style={styles.rootContainer}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{storeName}</Text>
          <Text style={styles.headerSubtitle}>Cajero: {cashierName}</Text>
        </View>

        {/* EARS-SYNC-03: Permanent visual badge */}
        <View style={styles.headerRight}>
          {offlineMode ? (
            <View testID="offline-badge" style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeDot}>●</Text>
              <Text style={styles.offlineBadgeText}>
                Modo Sin Conexión ({pendingOutboxCount} pendientes)
              </Text>
            </View>
          ) : (
            <View testID="online-badge" style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeDot}>●</Text>
              <Text style={styles.onlineBadgeText}>En Línea (Sincronizado)</Text>
            </View>
          )}
        </View>
      </View>

      {/* Status banner (messages, warnings) */}
      {statusMessage ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Main 60/40 Landscape Body */}
      <View testID="landscape-body" style={styles.landscapeBody}>
        {/* ========================================================================= */}
        {/* LEFT COLUMN: 60% Meat Cut Catalog Grid                                   */}
        {/* ========================================================================= */}
        <View testID="catalog-column" style={styles.catalogColumn}>
          {/* Category Tabs (height >= 48px, active highlight) */}
          <View style={styles.categoryTabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {categories.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <Pressable
                    key={category}
                    testID={`tab-category-${category}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Categoría ${category}`}
                    onPress={() => setSelectedCategory(category)}
                    style={({ pressed }) => [
                      styles.categoryTab,
                      isActive ? styles.categoryTabActive : styles.categoryTabInactive,
                      pressed ? styles.tabPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        isActive ? styles.categoryTabTextActive : styles.categoryTabTextInactive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Product Grid (minHeight >= 64, gap >= 8, bold title, visible price) */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productGrid}
          >
            {filteredProducts.map((product) => {
              const isWeight = product.tipoVenta === 'peso';
              return (
                <Pressable
                  key={product.id}
                  testID={`product-card-${product.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar ${product.nombre}, ${formatCOP(product.precio)}`}
                  onPress={() => handleSelectProduct(product)}
                  style={({ pressed }) => [
                    styles.productCard,
                    pressed ? styles.productCardPressed : null,
                  ]}
                >
                  <View style={styles.productCardHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.nombre}
                    </Text>
                    <View style={isWeight ? styles.weightBadge : styles.unitBadge}>
                      <Text style={isWeight ? styles.weightBadgeText : styles.unitBadgeText}>
                        {isWeight ? 'POR KG' : 'POR UNID'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productPriceRow}>
                    <Text style={styles.productPrice}>
                      {formatCOP(product.precio)}
                    </Text>
                    <Text style={styles.productUnit}>
                      {isWeight ? '/ kg' : '/ unid'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: 40% Live Weight Display & Real-time Comanda Checkout        */}
        {/* ========================================================================= */}
        <View testID="checkout-column" style={styles.checkoutColumn}>
          {/* Live Weight Display (fontSize >= 48, bold, high contrast, stability) */}
          <View style={styles.scaleDisplayContainer}>
            <View style={styles.scaleHeaderRow}>
              <Text style={styles.scaleLabel}>BÁSCULA EN VIVO</Text>
              <View
                style={[
                  styles.stabilityBadge,
                  isScaleStable ? styles.stabilityStable : styles.stabilityWeighing,
                ]}
              >
                <Text
                  style={[
                    styles.stabilityText,
                    isScaleStable ? styles.stabilityTextStable : styles.stabilityTextWeighing,
                  ]}
                >
                  {isScaleStable ? 'ESTABLE' : 'PESANDO'}
                </Text>
              </View>
            </View>

            <View style={styles.scaleDigitsRow}>
              <Text testID="live-weight-display" style={styles.scaleWeightDigits}>
                {formatWeight(liveWeight)}
              </Text>
            </View>

            {/* Quick Tare / Zero controls */}
            <View style={styles.scaleControlsRow}>
              <Pressable
                testID="btn-tare"
                accessibilityRole="button"
                accessibilityLabel="Tara de báscula"
                onPress={onTare}
                style={styles.scaleActionButton}
              >
                <Text style={styles.scaleActionText}>TARA</Text>
              </Pressable>
              <Pressable
                testID="btn-zero"
                accessibilityRole="button"
                accessibilityLabel="Cero de báscula"
                onPress={onZero}
                style={styles.scaleActionButton}
              >
                <Text style={styles.scaleActionText}>CERO</Text>
              </Pressable>
            </View>
          </View>

          {/* Real-Time Comanda Ticket List */}
          <View style={styles.ticketSection}>
            <View style={styles.ticketHeaderRow}>
              <Text style={styles.ticketTitle}>
                Comanda ({ticketItems.length} ítems)
              </Text>
              {ticketItems.length > 0 ? (
                <Pressable
                  testID="btn-clear-ticket"
                  accessibilityRole="button"
                  accessibilityLabel="Vaciar comanda"
                  onPress={handleClearTicket}
                  style={styles.clearTicketButton}
                >
                  <Text style={styles.clearTicketText}>Vaciar</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              style={styles.ticketList}
              contentContainerStyle={styles.ticketListContent}
              showsVerticalScrollIndicator={true}
            >
              {ticketItems.length === 0 ? (
                <View style={styles.emptyTicketContainer}>
                  <Text style={styles.emptyTicketText}>
                    Comanda vacía.
                  </Text>
                  <Text style={styles.emptyTicketSubtext}>
                    Seleccione cortes en el catálogo izquierdo para agregar a la venta.
                  </Text>
                </View>
              ) : (
                ticketItems.map((item) => (
                  <View key={item.id} style={styles.ticketItemRow}>
                    <View style={styles.ticketItemInfo}>
                      <Text style={styles.ticketItemName}>{item.nombre}</Text>
                      <Text style={styles.ticketItemDetail}>
                        {item.tipoVenta === 'peso'
                          ? `${formatWeight(item.cantidad)} × ${formatCOP(item.precioUnitario)}/kg`
                          : `${item.cantidad} unid × ${formatCOP(item.precioUnitario)}`}
                      </Text>
                    </View>

                    <Text style={styles.ticketItemSubtotal}>
                      {formatCOP(item.subtotal)}
                    </Text>

                    <Pressable
                      testID={`remove-item-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${item.nombre} de comanda`}
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* Prominent Gran Total Display (fontSize >= 32) */}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>GRAN TOTAL</Text>
            <Text testID="gran-total-display" style={styles.totalAmount}>
              {formatCOP(granTotal)}
            </Text>
          </View>

          {/* Fast Cash Buttons for Colombian Currency ($10k, $20k, $50k, $100k + Exacto) */}
          <View style={styles.cashSection}>
            <View style={styles.cashRowHeader}>
              <Text style={styles.cashSectionTitle}>Billetes Rápidos (COP)</Text>
              {efectivoRecibido > 0 ? (
                <Pressable
                  testID="btn-clear-cash"
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar efectivo recibido"
                  onPress={handleClearCash}
                >
                  <Text style={styles.clearCashText}>Limpiar</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.cashButtonsRow}>
              {FAST_CASH_DENOMINATIONS.map((bill) => (
                <Pressable
                  key={bill}
                  testID={`btn-cash-${bill}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Sumar ${formatCOP(bill)} de efectivo`}
                  onPress={() => handleFastCash(bill)}
                  style={({ pressed }) => [
                    styles.cashButton,
                    pressed ? styles.cashButtonPressed : null,
                  ]}
                >
                  <Text style={styles.cashButtonText}>{formatCOP(bill)}</Text>
                </Pressable>
              ))}
              <Pressable
                testID="btn-cash-exacto"
                accessibilityRole="button"
                accessibilityLabel="Pago con monto exacto"
                onPress={handleExactCash}
                style={({ pressed }) => [
                  styles.cashButtonExacto,
                  pressed ? styles.cashButtonPressed : null,
                ]}
              >
                <Text style={styles.cashButtonExactoText}>Exacto</Text>
              </Pressable>
            </View>

            {/* Instant Change Calculation Display */}
            <View style={styles.changeBreakdownBox}>
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Efectivo Recibido:</Text>
                <Text testID="efectivo-recibido-display" style={styles.changeValueReceived}>
                  {formatCOP(efectivoRecibido)}
                </Text>
              </View>

              {efectivoRecibido >= granTotal ? (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabelHighlight}>CAMBIO A ENTREGAR:</Text>
                  <Text testID="cambio-display" style={styles.changeValueHighlight}>
                    {formatCOP(cambio)}
                  </Text>
                </View>
              ) : (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabelPending}>Faltante por cobrar:</Text>
                  <Text testID="faltante-display" style={styles.changeValuePending}>
                    {formatCOP(faltante)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Button: COBRAR E IMPRIMIR TICKET (minHeight >= 64, prominent color) */}
          <Pressable
            testID="btn-cobrar"
            accessibilityRole="button"
            accessibilityLabel="Cobrar e imprimir ticket de comanda"
            disabled={isCheckoutDisabled}
            onPress={handleCheckout}
            style={({ pressed }) => [
              styles.checkoutButton,
              isCheckoutDisabled ? styles.checkoutButtonDisabled : styles.checkoutButtonActive,
              pressed && !isCheckoutDisabled ? styles.checkoutButtonPressed : null,
            ]}
          >
            <Text style={styles.checkoutButtonText}>
              COBRAR E IMPRIMIR TICKET
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

interface Styles {
  rootContainer: ViewStyle;
  header: ViewStyle;
  headerLeft: ViewStyle;
  headerTitle: TextStyle;
  headerSubtitle: TextStyle;
  headerRight: ViewStyle;
  offlineBadge: ViewStyle;
  offlineBadgeDot: TextStyle;
  offlineBadgeText: TextStyle;
  onlineBadge: ViewStyle;
  onlineBadgeDot: TextStyle;
  onlineBadgeText: TextStyle;
  statusBanner: ViewStyle;
  statusBannerText: TextStyle;
  landscapeBody: ViewStyle;
  catalogColumn: ViewStyle;
  categoryTabsContainer: ViewStyle;
  categoryTabsContent: ViewStyle;
  categoryTab: ViewStyle;
  categoryTabActive: ViewStyle;
  categoryTabInactive: ViewStyle;
  tabPressed: ViewStyle;
  categoryTabText: TextStyle;
  categoryTabTextActive: TextStyle;
  categoryTabTextInactive: TextStyle;
  productGrid: ViewStyle;
  productCard: ViewStyle;
  productCardPressed: ViewStyle;
  productCardHeader: ViewStyle;
  productName: TextStyle;
  weightBadge: ViewStyle;
  weightBadgeText: TextStyle;
  unitBadge: ViewStyle;
  unitBadgeText: TextStyle;
  productPriceRow: ViewStyle;
  productPrice: TextStyle;
  productUnit: TextStyle;
  checkoutColumn: ViewStyle;
  scaleDisplayContainer: ViewStyle;
  scaleHeaderRow: ViewStyle;
  scaleLabel: TextStyle;
  stabilityBadge: ViewStyle;
  stabilityStable: ViewStyle;
  stabilityWeighing: ViewStyle;
  stabilityText: TextStyle;
  stabilityTextStable: TextStyle;
  stabilityTextWeighing: TextStyle;
  scaleDigitsRow: ViewStyle;
  scaleWeightDigits: TextStyle;
  scaleControlsRow: ViewStyle;
  scaleActionButton: ViewStyle;
  scaleActionText: TextStyle;
  ticketSection: ViewStyle;
  ticketHeaderRow: ViewStyle;
  ticketTitle: TextStyle;
  clearTicketButton: ViewStyle;
  clearTicketText: TextStyle;
  ticketList: ViewStyle;
  ticketListContent: ViewStyle;
  emptyTicketContainer: ViewStyle;
  emptyTicketText: TextStyle;
  emptyTicketSubtext: TextStyle;
  ticketItemRow: ViewStyle;
  ticketItemInfo: ViewStyle;
  ticketItemName: TextStyle;
  ticketItemDetail: TextStyle;
  ticketItemSubtotal: TextStyle;
  removeButton: ViewStyle;
  removeButtonText: TextStyle;
  totalBox: ViewStyle;
  totalLabel: TextStyle;
  totalAmount: TextStyle;
  cashSection: ViewStyle;
  cashRowHeader: ViewStyle;
  cashSectionTitle: TextStyle;
  clearCashText: TextStyle;
  cashButtonsRow: ViewStyle;
  cashButton: ViewStyle;
  cashButtonPressed: ViewStyle;
  cashButtonText: TextStyle;
  cashButtonExacto: ViewStyle;
  cashButtonExactoText: TextStyle;
  changeBreakdownBox: ViewStyle;
  changeRow: ViewStyle;
  changeLabel: TextStyle;
  changeValueReceived: TextStyle;
  changeLabelHighlight: TextStyle;
  changeValueHighlight: TextStyle;
  changeLabelPending: TextStyle;
  changeValuePending: TextStyle;
  checkoutButton: ViewStyle;
  checkoutButtonActive: ViewStyle;
  checkoutButtonDisabled: ViewStyle;
  checkoutButtonPressed: ViewStyle;
  checkoutButtonText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  rootContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0f172a',
  },
  header: {
    height: 56,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350f',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: 'continuous',
    gap: 6,
  },
  offlineBadgeDot: {
    color: '#fbbf24',
    fontSize: 12,
  },
  offlineBadgeText: {
    color: '#fef3c7',
    fontSize: 13,
    fontWeight: '700',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: 'continuous',
    gap: 6,
  },
  onlineBadgeDot: {
    color: '#34d399',
    fontSize: 12,
  },
  onlineBadgeText: {
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  statusBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
  },
  // 60% Left Catalog
  catalogColumn: {
    flex: 6,
    backgroundColor: '#f1f5f9',
    padding: 12,
    flexDirection: 'column',
    gap: 10,
  },
  categoryTabsContainer: {
    height: 52,
  },
  categoryTabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTab: {
    minHeight: 48,
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  categoryTabActive: {
    backgroundColor: '#b91c1c',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  categoryTabInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tabPressed: {
    opacity: 0.8,
  },
  categoryTabText: {
    fontSize: 15,
  },
  categoryTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  categoryTabTextInactive: {
    color: '#334155',
    fontWeight: '600',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 24,
  },
  productCard: {
    minHeight: 74,
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderCurve: 'continuous',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  productCardPressed: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  productName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  weightBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  weightBadgeText: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: '800',
  },
  unitBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  unitBadgeText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    gap: 4,
  },
  productPrice: {
    color: '#b91c1c',
    fontSize: 17,
    fontWeight: '800',
  },
  productUnit: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },

  // 40% Right Checkout & Live Scale
  checkoutColumn: {
    flex: 4,
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'column',
    borderLeftWidth: 2,
    borderLeftColor: '#e2e8f0',
    justifyContent: 'space-between',
  },

  // Giant Scale Display (fontSize >= 48)
  scaleDisplayContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderCurve: 'continuous',
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scaleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scaleLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  stabilityStable: {
    backgroundColor: '#065f46',
  },
  stabilityWeighing: {
    backgroundColor: '#854d0e',
  },
  stabilityText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stabilityTextStable: {
    color: '#34d399',
  },
  stabilityTextWeighing: {
    color: '#fde047',
  },
  scaleDigitsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  scaleWeightDigits: {
    color: '#22c55e',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  scaleControlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  scaleActionButton: {
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#334155',
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  scaleActionText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },

  // Comanda Ticket Section
  ticketSection: {
    flex: 1,
    minHeight: 120,
    maxHeight: 220,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ticketTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  clearTicketButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clearTicketText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketList: {
    flex: 1,
  },
  ticketListContent: {
    padding: 8,
    gap: 6,
  },
  emptyTicketContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTicketText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyTicketSubtext: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  ticketItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 6,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 48,
  },
  ticketItemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  ticketItemName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  ticketItemDetail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  ticketItemSubtotal: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 8,
  },
  removeButton: {
    minHeight: 36,
    minWidth: 36,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '900',
  },

  // Prominent Gran Total Box (fontSize >= 32)
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderCurve: 'continuous',
    marginVertical: 4,
  },
  totalLabel: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalAmount: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },

  // Fast Cash Section ($10k, $20k, $50k, $100k + Exacto)
  cashSection: {
    gap: 6,
    marginVertical: 4,
  },
  cashRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashSectionTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  clearCashText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  cashButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cashButton: {
    flex: 1,
    minHeight: 64,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cashButtonPressed: {
    backgroundColor: '#e2e8f0',
  },
  cashButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  cashButtonExacto: {
    flex: 1,
    minHeight: 64,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#818cf8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cashButtonExactoText: {
    color: '#3730a3',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Instant Change Display
  changeBreakdownBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    borderCurve: 'continuous',
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  changeValueReceived: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  changeLabelHighlight: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: '800',
  },
  changeValueHighlight: {
    color: '#15803d',
    fontSize: 18,
    fontWeight: '900',
  },
  changeLabelPending: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  changeValuePending: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '800',
  },

  // Action Button: COBRAR E IMPRIMIR TICKET (minHeight >= 64)
  checkoutButton: {
    minHeight: 64,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  checkoutButtonActive: {
    backgroundColor: '#15803d',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  checkoutButtonPressed: {
    backgroundColor: '#166534',
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

export default VentaTabletScreen;
