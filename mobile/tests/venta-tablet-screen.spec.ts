import React from 'react';
import {
  VentaTabletScreen,
  formatCOP,
  formatWeight,
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  FAST_CASH_DENOMINATIONS,
  type VentaTabletScreenProps,
  type CompletedSale,
} from '../src/screens';

// Helper to recursively find an element in the React element tree, supporting nested arrays
function findElement(element: any, predicate: (el: any) => boolean): any {
  if (!element) return null;
  if (Array.isArray(element)) {
    for (const item of element) {
      const found = findElement(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (typeof element !== 'object') return null;
  if (predicate(element)) return element;
  if (element.props?.children) {
    return findElement(element.props.children, predicate);
  }
  return null;
}

// Helper to find all elements matching a predicate, supporting nested arrays
function findAllElements(element: any, predicate: (el: any) => boolean): any[] {
  const results: any[] = [];
  function search(el: any) {
    if (!el) return;
    if (Array.isArray(el)) {
      el.forEach(search);
      return;
    }
    if (typeof el !== 'object') return;
    if (predicate(el)) results.push(el);
    if (el.props?.children) {
      search(el.props.children);
    }
  }
  search(element);
  return results;
}

// Helper to extract text from a component tree
function getElementText(element: any): string {
  if (!element) return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) {
    return element.map(getElementText).join('');
  }
  if (element.props?.children) {
    return getElementText(element.props.children);
  }
  return '';
}

// Helper to resolve styles (handles functions `({ pressed }) => ...` and arrays)
function resolveStyle(element: any, state = { pressed: false }): Record<string, any> {
  if (!element || !element.props) return {};
  const styleProp = element.props.style;
  const raw = typeof styleProp === 'function' ? styleProp(state) : styleProp;
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return Object.assign({}, ...raw.filter(Boolean));
  }
  return raw;
}

// Lightweight stateful renderer using React internals
function renderScreen(props: VentaTabletScreenProps = {}) {
  const states: any[] = [];
  let stateCursor = 0;

  const dispatcher = {
    useState(initial: any) {
      const index = stateCursor++;
      if (states[index] === undefined) {
        states[index] = typeof initial === 'function' ? initial() : initial;
      }
      const setter = (val: any) => {
        const next = typeof val === 'function' ? val(states[index]) : val;
        states[index] = next;
      };
      return [states[index], setter];
    },
    useMemo(fn: () => any) {
      return fn();
    },
  };

  function renderTree() {
    stateCursor = 0;
    const prev = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    try {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
      return VentaTabletScreen(props);
    } finally {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = prev;
    }
  }

  return {
    getTree: () => renderTree(),
    findByTestId: (testID: string) => findElement(renderTree(), (el) => el.props?.testID === testID),
    findAllByTestId: (prefix: string) =>
      findAllElements(renderTree(), (el) => typeof el.props?.testID === 'string' && el.props.testID.startsWith(prefix)),
    firePress: (testID: string) => {
      const el = findElement(renderTree(), (node) => node.props?.testID === testID);
      if (!el) throw new Error(`Element with testID "${testID}" not found`);
      if (typeof el.props?.onPress !== 'function') throw new Error(`Element "${testID}" has no onPress`);
      el.props.onPress();
    },
  };
}

describe('VentaTabletScreen Suite (TASK-29)', () => {
  describe('1. Formatting Utilities', () => {
    it('should format Colombian pesos (formatCOP) with dot thousand separators', () => {
      expect(formatCOP(0)).toBe('$ 0');
      expect(formatCOP(3500)).toBe('$ 3.500');
      expect(formatCOP(10000)).toBe('$ 10.000');
      expect(formatCOP(38000)).toBe('$ 38.000');
      expect(formatCOP(78400)).toBe('$ 78.400');
      expect(formatCOP(100000)).toBe('$ 100.000');
    });

    it('should format weight (formatWeight) with exactly 3 decimal places and kg suffix', () => {
      expect(formatWeight(0)).toBe('0.000 kg');
      expect(formatWeight(2.45)).toBe('2.450 kg');
      expect(formatWeight(1.005)).toBe('1.005 kg');
      expect(formatWeight(0.5)).toBe('0.500 kg');
    });

    it('should provide complete default meat cuts and Colombian cash denominations', () => {
      expect(DEFAULT_CATEGORIES).toEqual(['Todos', 'Res', 'Cerdo', 'Pollo', 'Vísceras']);
      expect(DEFAULT_PRODUCTS.length).toBeGreaterThanOrEqual(15);
      expect(FAST_CASH_DENOMINATIONS).toEqual([10000, 20000, 50000, 100000]);
    });
  });

  describe('2. Layout & Architectural Ergonomics (Landscape 60/40)', () => {
    it('should implement landscape layout with 60/40 proportion (flex: 6 and flex: 4)', () => {
      const { findByTestId } = renderScreen();
      const landscapeBody = findByTestId('landscape-body');
      expect(landscapeBody).toBeTruthy();
      expect(landscapeBody.props?.style?.flexDirection).toBe('row');

      const catalogCol = findByTestId('catalog-column');
      const checkoutCol = findByTestId('checkout-column');

      // 60% Left Catalog
      expect(catalogCol.props?.style?.flex).toBe(6);
      // 40% Right Checkout
      expect(checkoutCol.props?.style?.flex).toBe(4);
    });

    it('should configure category tabs with minHeight >= 48px', () => {
      const { findByTestId } = renderScreen();
      const tabRes = findByTestId('tab-category-Res');
      expect(tabRes).toBeTruthy();

      const styles = resolveStyle(tabRes);
      expect(styles.minHeight).toBeGreaterThanOrEqual(48);
    });

    it('should configure product cut buttons with minHeight >= 64px and gap >= 8px', () => {
      const { findByTestId, getTree } = renderScreen();
      const card = findByTestId('product-card-prod-res-01');
      expect(card).toBeTruthy();

      const cardStyles = resolveStyle(card);
      expect(cardStyles.minHeight).toBeGreaterThanOrEqual(64);

      // Verify product grid gap
      const tree = getTree();
      const grid = findElement(tree, (el) => el.props?.contentContainerStyle?.gap >= 8);
      expect(grid).toBeTruthy();
    });

    it('should configure live scale display with fontSize >= 48', () => {
      const { findByTestId } = renderScreen({ liveWeight: 2.450 });
      const weightDisplay = findByTestId('live-weight-display');
      expect(weightDisplay).toBeTruthy();

      const style = weightDisplay.props.style;
      expect(style.fontSize).toBeGreaterThanOrEqual(48);
      expect(getElementText(weightDisplay)).toBe('2.450 kg');
    });

    it('should configure prominent Gran Total display with fontSize >= 32', () => {
      const { findByTestId } = renderScreen();
      const totalDisplay = findByTestId('gran-total-display');
      expect(totalDisplay).toBeTruthy();

      const style = totalDisplay.props.style;
      expect(style.fontSize).toBeGreaterThanOrEqual(32);
    });

    it('should configure fast cash buttons with minHeight >= 64px', () => {
      const { findByTestId } = renderScreen();
      const btn50k = findByTestId('btn-cash-50000');
      expect(btn50k).toBeTruthy();

      const style = resolveStyle(btn50k);
      expect(style.minHeight).toBeGreaterThanOrEqual(64);
    });

    it('should configure COBRAR button with minHeight >= 64px and prominent color', () => {
      const { findByTestId } = renderScreen();
      const btnCobrar = findByTestId('btn-cobrar');
      expect(btnCobrar).toBeTruthy();

      const style = resolveStyle(btnCobrar);
      expect(style.minHeight).toBeGreaterThanOrEqual(64);
    });
  });

  describe('3. Offline Mode Badge (EARS-SYNC-03)', () => {
    it('should render "Modo Sin Conexión" badge with pending count when offlineMode is true', () => {
      const { findByTestId } = renderScreen({ offlineMode: true, pendingOutboxCount: 5 });
      const offlineBadge = findByTestId('offline-badge');
      expect(offlineBadge).toBeTruthy();

      const text = getElementText(offlineBadge);
      expect(text).toContain('Modo Sin Conexión');
      expect(text).toContain('5 pendientes');
    });

    it('should render "En Línea (Sincronizado)" badge when offlineMode is false', () => {
      const { findByTestId } = renderScreen({ offlineMode: false });
      const onlineBadge = findByTestId('online-badge');
      expect(onlineBadge).toBeTruthy();

      const text = getElementText(onlineBadge);
      expect(text).toContain('En Línea (Sincronizado)');
    });
  });

  describe('4. Interactive Comanda & Checkout Workflow', () => {
    it('should display ESTABLE and PESANDO according to isScaleStable prop', () => {
      const screenStable = renderScreen({ isScaleStable: true });
      expect(getElementText(screenStable.getTree())).toContain('ESTABLE');

      const screenWeighing = renderScreen({ isScaleStable: false });
      expect(getElementText(screenWeighing.getTree())).toContain('PESANDO');
    });

    it('should filter product cards when switching categories', () => {
      const { firePress, findAllByTestId } = renderScreen();

      // Switch to Cerdo
      firePress('tab-category-Cerdo');
      const cerdoCards = findAllByTestId('product-card-prod-cer-');
      const resCards = findAllByTestId('product-card-prod-res-');
      expect(cerdoCards.length).toBeGreaterThanOrEqual(3);
      expect(resCards.length).toBe(0);
    });

    it('should add weighted product cut to comanda using liveWeight', () => {
      const { firePress, findByTestId } = renderScreen({ liveWeight: 1.500 });

      // Select Lomo Fino de Res ($38.000/kg)
      firePress('product-card-prod-res-01');

      // Subtotal should be 1.500 * 38000 = 57000
      const totalDisplay = findByTestId('gran-total-display');
      expect(getElementText(totalDisplay)).toBe('$ 57.000');
    });

    it('should add unit product to comanda with 1 unit quantity', () => {
      const { firePress, findByTestId } = renderScreen({ liveWeight: 0 });

      // Select Chorizo Casero ($3.500 unit)
      firePress('tab-category-Cerdo');
      firePress('product-card-prod-cer-05');

      const totalDisplay = findByTestId('gran-total-display');
      expect(getElementText(totalDisplay)).toBe('$ 3.500');
    });

    it('should prevent adding weighted cut if scale weight is <= 0.000 kg', () => {
      const { firePress, getTree, findByTestId } = renderScreen({ liveWeight: 0 });

      // Try selecting Lomo Fino de Res with 0 kg
      firePress('product-card-prod-res-01');

      // Warning message displayed
      const text = getElementText(getTree());
      expect(text).toContain('Coloque el corte en la báscula');

      // Grand total remains 0
      const totalDisplay = findByTestId('gran-total-display');
      expect(getElementText(totalDisplay)).toBe('$ 0');
    });

    it('should calculate instant change and handle fast cash shortcuts', () => {
      const { firePress, findByTestId } = renderScreen({ liveWeight: 1.000 });

      // Add Lomo Fino ($38.000)
      firePress('product-card-prod-res-01');

      // Check Gran Total = $38.000
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 38.000');

      // Press $50.000 bill
      firePress('btn-cash-50000');

      // Efectivo = $50.000
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 50.000');

      // Cambio = $50.000 - $38.000 = $12.000
      const cambioDisplay = findByTestId('cambio-display');
      expect(getElementText(cambioDisplay)).toBe('$ 12.000');
    });

    it('should handle "Exacto" fast cash button', () => {
      const { firePress, findByTestId } = renderScreen({ liveWeight: 2.000 });

      // Add Costilla de Res ($22.000/kg * 2 = $44.000)
      firePress('product-card-prod-res-02');
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 44.000');

      // Press Exacto
      firePress('btn-cash-exacto');

      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 44.000');
      expect(getElementText(findByTestId('cambio-display'))).toBe('$ 0');
    });

    it('should remove items and clear comanda properly', () => {
      const { firePress, findByTestId, getTree } = renderScreen({ liveWeight: 1.000 });

      firePress('product-card-prod-res-01');
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 38.000');

      // Clear ticket
      firePress('btn-clear-ticket');
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 0');
      expect(getElementText(getTree())).toContain('Comanda vacía');
    });

    it('should execute checkout and invoke onCobrar callback when valid', () => {
      const onCobrarMock = jest.fn();
      const { firePress, findByTestId } = renderScreen({
        liveWeight: 1.000,
        onCobrar: onCobrarMock,
      });

      // Add Lomo Fino ($38.000)
      firePress('product-card-prod-res-01');

      // Pay with $50.000
      firePress('btn-cash-50000');

      // Press COBRAR E IMPRIMIR TICKET
      firePress('btn-cobrar');

      expect(onCobrarMock).toHaveBeenCalledTimes(1);
      const sale: CompletedSale = onCobrarMock.mock.calls[0][0];
      expect(sale.total).toBe(38000);
      expect(sale.efectivo).toBe(50000);
      expect(sale.cambio).toBe(12000);
      expect(sale.items.length).toBe(1);
      expect(sale.items[0].nombre).toBe('Lomo Fino de Res');
      expect(sale.metodoPago).toBe('efectivo');

      // Comanda is cleared after checkout
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 0');
    });
  });
});
