export type TipoVenta = 'peso' | 'unidad';
export type UnidadMedida = 'kg' | 'g' | 'unidad';

export interface ProductoProps {
  id: string;
  negocioId: string;
  categoriaId: string;
  nombre: string;
  codigoBarras?: string | null;
  tipoVenta: TipoVenta;
  unidadMedida: UnidadMedida;
  precio: number;
  costoPromedio?: number;
  fotoUrl?: string | null;
  activo?: boolean;
}

export interface ProductoResponseDto {
  id: string;
  negocioId: string;
  categoriaId: string;
  nombre: string;
  codigoBarras: string | null;
  tipoVenta: TipoVenta;
  unidadMedida: UnidadMedida;
  precio: number;
  costoPromedio: number;
  fotoUrl: string | null;
  activo: boolean;
}

export class Producto {
  private readonly _id: string;
  private readonly _negocioId: string;
  private _categoriaId: string;
  private _nombre: string;
  private _codigoBarras: string | null;
  private _tipoVenta: TipoVenta;
  private _unidadMedida: UnidadMedida;
  private _precio: number;
  private _costoPromedio: number;
  private _fotoUrl: string | null;
  private _activo: boolean;

  constructor(props: ProductoProps) {
    if (!props.id) throw new Error('El ID del producto es obligatorio');
    if (!props.negocioId) throw new Error('El negocioId es obligatorio para aislamiento multi-tenant');
    if (!props.categoriaId) throw new Error('El categoriaId es obligatorio');
    if (!props.nombre || props.nombre.trim().length === 0) {
      throw new Error('El nombre del producto es obligatorio');
    }

    if (!['peso', 'unidad'].includes(props.tipoVenta)) {
      throw new Error(`Tipo de venta inválido: ${props.tipoVenta}. Debe ser 'peso' o 'unidad'`);
    }

    if (!['kg', 'g', 'unidad'].includes(props.unidadMedida)) {
      throw new Error(`Unidad de medida inválida: ${props.unidadMedida}. Debe ser 'kg', 'g' o 'unidad'`);
    }

    // Validación de coherencia tipo_venta vs unidad_medida (design.md sec. 2, US-03)
    if (props.tipoVenta === 'peso' && props.unidadMedida === 'unidad') {
      throw new Error("Un producto por peso no puede tener unidad de medida 'unidad'. Debe ser 'kg' o 'g'");
    }

    if (props.tipoVenta === 'unidad' && props.unidadMedida !== 'unidad') {
      throw new Error("Un producto por unidad debe tener unidad de medida 'unidad'");
    }

    if (props.precio === undefined || props.precio <= 0) {
      throw new Error('El precio debe ser un valor numérico estrictamente mayor a cero');
    }

    const costo = props.costoPromedio !== undefined ? props.costoPromedio : 0;
    if (costo < 0) {
      throw new Error('El costo promedio no puede ser negativo');
    }

    this._id = props.id;
    this._negocioId = props.negocioId;
    this._categoriaId = props.categoriaId;
    this._nombre = props.nombre.trim();
    this._codigoBarras = props.codigoBarras?.trim() || null;
    this._tipoVenta = props.tipoVenta;
    this._unidadMedida = props.unidadMedida;
    this._precio = Number(props.precio.toFixed(2));
    this._costoPromedio = Number(costo.toFixed(2));
    this._fotoUrl = props.fotoUrl?.trim() || null;
    this._activo = props.activo !== undefined ? props.activo : true;
  }

  get id(): string {
    return this._id;
  }

  get negocioId(): string {
    return this._negocioId;
  }

  get categoriaId(): string {
    return this._categoriaId;
  }

  get nombre(): string {
    return this._nombre;
  }

  get codigoBarras(): string | null {
    return this._codigoBarras;
  }

  get tipoVenta(): TipoVenta {
    return this._tipoVenta;
  }

  get unidadMedida(): UnidadMedida {
    return this._unidadMedida;
  }

  get precio(): number {
    return this._precio;
  }

  get costoPromedio(): number {
    return this._costoPromedio;
  }

  get fotoUrl(): string | null {
    return this._fotoUrl;
  }

  get activo(): boolean {
    return this._activo;
  }

  /**
   * Calcula el subtotal monetario de una línea de venta (EARS-VENTA-01).
   * Multiplica la cantidad (hasta 3 decimales en peso kg) por el precio unitario,
   * redondeando a 2 decimales monetarios.
   */
  public calcularSubtotalLinea(cantidad: number): number {
    if (cantidad <= 0) {
      throw new Error('La cantidad a vender debe ser mayor a cero');
    }

    if (this._tipoVenta === 'unidad' && !Number.isInteger(cantidad)) {
      throw new Error('Para productos por unidad, la cantidad debe ser un número entero');
    }

    // Precisión de hasta 3 decimales para báscula al gramo
    const cantidadAjustada = this._tipoVenta === 'peso' ? Number(cantidad.toFixed(3)) : cantidad;
    const subtotalBruto = cantidadAjustada * this._precio;

    // Redondeo a 2 decimales monetarios
    return Math.round((subtotalBruto + Number.EPSILON) * 100) / 100;
  }

  public actualizar(datos: {
    nombre?: string;
    categoriaId?: string;
    codigoBarras?: string | null;
    tipoVenta?: TipoVenta;
    unidadMedida?: UnidadMedida;
    precio?: number;
    costoPromedio?: number;
    fotoUrl?: string | null;
  }): void {
    if (datos.nombre !== undefined) {
      if (datos.nombre.trim().length === 0) {
        throw new Error('El nombre del producto no puede estar vacío');
      }
      this._nombre = datos.nombre.trim();
    }

    if (datos.categoriaId !== undefined) {
      if (!datos.categoriaId) throw new Error('El categoriaId no puede estar vacío');
      this._categoriaId = datos.categoriaId;
    }

    if (datos.codigoBarras !== undefined) {
      this._codigoBarras = datos.codigoBarras?.trim() || null;
    }

    const nuevoTipo = datos.tipoVenta !== undefined ? datos.tipoVenta : this._tipoVenta;
    const nuevaUnidad = datos.unidadMedida !== undefined ? datos.unidadMedida : this._unidadMedida;

    if (nuevoTipo === 'peso' && nuevaUnidad === 'unidad') {
      throw new Error("Un producto por peso no puede tener unidad de medida 'unidad'. Debe ser 'kg' o 'g'");
    }
    if (nuevoTipo === 'unidad' && nuevaUnidad !== 'unidad') {
      throw new Error("Un producto por unidad debe tener unidad de medida 'unidad'");
    }

    this._tipoVenta = nuevoTipo;
    this._unidadMedida = nuevaUnidad;

    if (datos.precio !== undefined) {
      if (datos.precio <= 0) {
        throw new Error('El precio debe ser mayor a cero');
      }
      this._precio = Number(datos.precio.toFixed(2));
    }

    if (datos.costoPromedio !== undefined) {
      if (datos.costoPromedio < 0) {
        throw new Error('El costo promedio no puede ser negativo');
      }
      this._costoPromedio = Number(datos.costoPromedio.toFixed(2));
    }

    if (datos.fotoUrl !== undefined) {
      this._fotoUrl = datos.fotoUrl?.trim() || null;
    }
  }

  public activar(): void {
    this._activo = true;
  }

  public desactivar(): void {
    this._activo = false;
  }

  public toResponseDto(): ProductoResponseDto {
    return {
      id: this._id,
      negocioId: this._negocioId,
      categoriaId: this._categoriaId,
      nombre: this._nombre,
      codigoBarras: this._codigoBarras,
      tipoVenta: this._tipoVenta,
      unidadMedida: this._unidadMedida,
      precio: this._precio,
      costoPromedio: this._costoPromedio,
      fotoUrl: this._fotoUrl,
      activo: this._activo,
    };
  }
}
