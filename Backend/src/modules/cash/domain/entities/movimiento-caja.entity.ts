export type TipoMovimientoCaja = 'ingreso' | 'egreso';

export type CategoriaMovimientoCaja =
  | 'compra_materia_prima'
  | 'flete_transporte'
  | 'insumos_empaque'
  | 'hielo_refrigeracion'
  | 'servicios_mantenimiento'
  | 'anticipo_nomina'
  | 'inyeccion_base'
  | 'abono_fiado'
  | 'sangria_seguridad'
  | 'otro';

export interface MovimientoCajaProps {
  id: string;
  corteId: string;
  sucursalId: string;
  dispositivoId?: string | null;
  usuarioId: string;
  autorizadoPorId?: string | null;
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimientoCaja;
  monto: number;
  beneficiarioProveedor?: string | null;
  comprobante?: string | null;
  descripcion: string;
  fechaHoraDispositivo?: Date;
  fechaHoraServidor?: Date;
  sincronizado?: boolean;
}

export class MovimientoCaja {
  public readonly id: string;
  public readonly corteId: string;
  public readonly sucursalId: string;
  public readonly dispositivoId: string | null;
  public readonly usuarioId: string;
  public readonly autorizadoPorId: string | null;
  public readonly tipo: TipoMovimientoCaja;
  public readonly categoria: CategoriaMovimientoCaja;
  public readonly monto: number;
  public readonly beneficiarioProveedor: string | null;
  public readonly comprobante: string | null;
  public readonly descripcion: string;
  public readonly fechaHoraDispositivo: Date;
  public readonly fechaHoraServidor: Date;
  public readonly sincronizado: boolean;

  constructor(props: MovimientoCajaProps) {
    if (!props.id) {
      throw new Error('El id del movimiento es obligatorio');
    }
    if (!props.corteId) {
      throw new Error('El corteId es obligatorio');
    }
    if (!props.sucursalId) {
      throw new Error('El sucursalId es obligatorio');
    }
    if (!props.usuarioId) {
      throw new Error('El usuarioId es obligatorio');
    }
    if (props.monto === undefined || props.monto === null || Number(props.monto) <= 0) {
      throw new Error('El monto del movimiento debe ser un valor positivo mayor a 0');
    }
    if (!props.descripcion || props.descripcion.trim() === '') {
      throw new Error('La descripción o justificación del movimiento es obligatoria');
    }

    this.id = props.id;
    this.corteId = props.corteId;
    this.sucursalId = props.sucursalId;
    this.dispositivoId = props.dispositivoId ?? null;
    this.usuarioId = props.usuarioId;
    this.autorizadoPorId = props.autorizadoPorId ?? null;
    this.tipo = props.tipo;
    this.categoria = props.categoria;
    this.monto = Math.round(Number(props.monto) * 100) / 100;
    this.beneficiarioProveedor = props.beneficiarioProveedor ?? null;
    this.comprobante = props.comprobante ?? null;
    this.descripcion = props.descripcion.trim();
    this.fechaHoraDispositivo = props.fechaHoraDispositivo ?? new Date();
    this.fechaHoraServidor = props.fechaHoraServidor ?? new Date();
    this.sincronizado = props.sincronizado ?? true;
  }

  public esIngreso(): boolean {
    return this.tipo === 'ingreso';
  }

  public esEgreso(): boolean {
    return this.tipo === 'egreso';
  }

  public toJSON() {
    return {
      id: this.id,
      corteId: this.corteId,
      sucursalId: this.sucursalId,
      dispositivoId: this.dispositivoId,
      usuarioId: this.usuarioId,
      autorizadoPorId: this.autorizadoPorId,
      tipo: this.tipo,
      categoria: this.categoria,
      monto: this.monto,
      beneficiarioProveedor: this.beneficiarioProveedor,
      comprobante: this.comprobante,
      descripcion: this.descripcion,
      fechaHoraDispositivo: this.fechaHoraDispositivo,
      fechaHoraServidor: this.fechaHoraServidor,
      sincronizado: this.sincronizado,
    };
  }
}