/**
 * Generador de Comandos ESC/POS para Impresión Térmica de Tickets de Carnicería
 * Diseñado según design.md Sec. 12 y requisitos US-04, EARS-VENTA-04.
 * 
 * Soporta anchos estándar de papel térmico:
 * - 58 mm: 32 caracteres por línea
 * - 80 mm: 48 caracteres por línea
 */

export interface TicketItem {
  nombre: string;
  cantidad: number;
  unidadMedida: string; // 'kg' | 'und' | 'pieza'
  precioUnitario: number;
  subtotal: number;
}

export interface TicketPago {
  metodo: 'efectivo' | 'tarjeta' | 'transferencia';
  monto: number;
}

export interface TicketData {
  negocioNombre: string;
  negocioNit?: string;
  sucursalNombre: string;
  direccion?: string;
  telefono?: string;
  ventaId: string;
  fecha: Date | string;
  cajeroNombre?: string;
  items: TicketItem[];
  total: number;
  pagos: TicketPago[];
  cambio: number;
  mensajePie?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private readonly width: number;

  constructor(paperWidth: 58 | 80 = 80) {
    this.width = paperWidth === 58 ? 32 : 48;
    this.init();
  }

  /** Inicializar impresora (ESC @) */
  init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /** Alineación: 0 = Izq, 1 = Centro, 2 = Der (ESC a n) */
  align(align: 'left' | 'center' | 'right'): this {
    const val = align === 'left' ? 0 : align === 'center' ? 1 : 2;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  /** Negrita activada / desactivada (ESC E n) */
  bold(enable = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  /** Doble tamaño de texto (GS ! n) */
  doubleSize(enable = true): this {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  /** Escribir texto codificado en ASCII/latin1 */
  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  /** Escribir línea completa con salto */
  line(str = ''): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  /** Imprime una línea divisoria de guiones según el ancho de papel */
  divider(char = '-'): this {
    this.line(char.repeat(this.width));
    return this;
  }

  /**
   * Imprime dos textos en la misma línea: izquierda y derecha justificados
   * Ej: "Arrachera (1.250kg)"  "$323.75"
   */
  row(left: string, right: string): this {
    const spaceCount = Math.max(1, this.width - left.length - right.length);
    const lineStr = left + ' '.repeat(spaceCount) + right;
    this.line(lineStr.slice(0, this.width));
    return this;
  }

  /**
   * Alimenta papel n líneas (ESC d n)
   */
  feed(lines = 3): this {
    this.buffer.push(0x1b, 0x64, lines);
    return this;
  }

  /**
   * Corte de papel total / parcial (GS V 66 0)
   */
  cut(partial = false): this {
    this.buffer.push(0x1d, 0x56, partial ? 66 : 65, 0);
    return this;
  }

  /** Obtiene los bytes en formato Uint8Array */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Formatea un ticket completo de carnicería a bytes ESC/POS.
 */
export function generateEscPosCommands(
  ticket: TicketData,
  options?: { width?: 58 | 80 }
): Uint8Array {
  const width = options?.width || 80;
  const builder = new EscPosBuilder(width);

  // Encabezado centrado
  builder
    .align('center')
    .bold(true)
    .doubleSize(true)
    .line(ticket.negocioNombre.toUpperCase())
    .doubleSize(false);

  if (ticket.negocioNit) {
    builder.line(`NIT: ${ticket.negocioNit}`);
  }
  builder.line(ticket.sucursalNombre);
  if (ticket.direccion) builder.line(ticket.direccion);
  if (ticket.telefono) builder.line(`Tel: ${ticket.telefono}`);

  builder.divider('=');

  // Metadatos de la venta
  builder.align('left').bold(false);
  const fechaStr =
    ticket.fecha instanceof Date
      ? ticket.fecha.toLocaleString('es-CO')
      : new Date(ticket.fecha).toLocaleString('es-CO');

  builder.line(`Ticket #: ${ticket.ventaId.slice(0, 18)}`);
  builder.line(`Fecha:    ${fechaStr}`);
  if (ticket.cajeroNombre) {
    builder.line(`Cajero:   ${ticket.cajeroNombre}`);
  }

  builder.divider('-');

  // Detalle de Ítems
  builder.bold(true).row('PRODUCTO / CANTIDAD', 'SUBTOTAL').bold(false);
  builder.divider('-');

  for (const item of ticket.items) {
    const qtyStr =
      item.unidadMedida === 'kg'
        ? `${item.cantidad.toFixed(3)} kg`
        : `${item.cantidad} ${item.unidadMedida}`;
    
    const leftText = `${item.nombre}`;
    const subtotalText = `$${item.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

    builder.row(leftText, subtotalText);
    builder.line(`   ${qtyStr} x $${item.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`);
  }

  builder.divider('-');

  // Totales en negrita
  builder
    .bold(true)
    .doubleSize(true)
    .row('TOTAL:', `$${ticket.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`)
    .doubleSize(false)
    .bold(false);

  builder.divider('-');

  // Formas de pago
  builder.bold(true).line('DETALLE DE PAGO:').bold(false);
  for (const pago of ticket.pagos) {
    const metodoLabel =
      pago.metodo === 'efectivo'
        ? 'Efectivo'
        : pago.metodo === 'tarjeta'
        ? 'Tarjeta'
        : 'Transferencia';
    builder.row(
      `  ${metodoLabel}:`,
      `$${pago.monto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
    );
  }

  if (ticket.cambio > 0) {
    builder.bold(true).row(
      '  Cambio / Devuelta:',
      `$${ticket.cambio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
    ).bold(false);
  }

  builder.divider('=');

  // Pie de página
  builder
    .align('center')
    .line(ticket.mensajePie || '¡Gracias por su preferencia!')
    .line('Consérvese en refrigeración de 0° a 4°C')
    .feed(3)
    .cut();

  return builder.build();
}

/**
 * Genera una plantilla HTML de ticket lista para impresión en navegador (window.print).
 */
export function generateTicketHtml(ticket: TicketData): string {
  const fechaStr =
    ticket.fecha instanceof Date
      ? ticket.fecha.toLocaleString('es-CO')
      : new Date(ticket.fecha).toLocaleString('es-CO');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket ${ticket.ventaId}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 76mm;
          margin: 0 auto;
          padding: 3mm 2mm;
          font-size: 12px;
          color: #000;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .total-row { font-size: 16px; font-weight: bold; margin: 6px 0; }
        @media print {
          body { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="bold" style="font-size: 16px;">${ticket.negocioNombre.toUpperCase()}</div>
        ${ticket.negocioNit ? `<div>NIT: ${ticket.negocioNit}</div>` : ''}
        <div>${ticket.sucursalNombre}</div>
        ${ticket.direccion ? `<div>${ticket.direccion}</div>` : ''}
        ${ticket.telefono ? `<div>Tel: ${ticket.telefono}</div>` : ''}
      </div>

      <div class="divider"></div>
      <div>Ticket #: ${ticket.ventaId.slice(0, 18)}</div>
      <div>Fecha: ${fechaStr}</div>
      ${ticket.cajeroNombre ? `<div>Cajero: ${ticket.cajeroNombre}</div>` : ''}

      <div class="divider"></div>
      <div class="row bold">
        <span>PRODUCTO</span>
        <span>SUBTOTAL</span>
      </div>
      <div class="divider"></div>

      ${ticket.items
        .map(
          (item) => `
        <div class="row">
          <span class="bold">${item.nombre}</span>
          <span>$${item.subtotal.toFixed(2)}</span>
        </div>
        <div style="font-size: 10px; color: #333; margin-bottom: 3px;">
          ${item.unidadMedida === 'kg' ? item.cantidad.toFixed(3) + ' kg' : item.cantidad + ' ' + item.unidadMedida}
          x $${item.precioUnitario.toFixed(2)}
        </div>
      `
        )
        .join('')}

      <div class="divider"></div>
      <div class="row total-row">
        <span>TOTAL:</span>
        <span>$${ticket.total.toFixed(2)}</span>
      </div>
      <div class="divider"></div>

      <div class="bold" style="margin-top: 4px;">PAGOS:</div>
      ${ticket.pagos
        .map(
          (p) => `
        <div class="row">
          <span>${p.metodo.toUpperCase()}:</span>
          <span>$${p.monto.toFixed(2)}</span>
        </div>
      `
        )
        .join('')}

      ${
        ticket.cambio > 0
          ? `
        <div class="row bold">
          <span>CAMBIO / DEVUELTA:</span>
          <span>$${ticket.cambio.toFixed(2)}</span>
        </div>
      `
          : ''
      }

      <div class="divider"></div>
      <div class="text-center" style="margin-top: 8px; font-size: 11px;">
        <div>${ticket.mensajePie || '¡Gracias por su preferencia!'}</div>
        <div style="font-size: 9px; margin-top: 2px;">Consérvese en refrigeración (0° a 4°C)</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Dispara la impresión en una ventana emergente o iframe invisible en el navegador.
 */
export function printTicketInBrowser(ticket: TicketData): void {
  if (typeof window === 'undefined') return;

  const html = generateTicketHtml(ticket);
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}
