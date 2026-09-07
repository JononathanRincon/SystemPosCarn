export interface SucursalProps {
  id: string;
  negocioId: string;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  zonaHoraria?: string;
  activo?: boolean;
}

export interface SucursalResponseDto {
  id: string;
  negocioId: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  zonaHoraria: string;
  activo: boolean;
}

export class Sucursal {
  private readonly _id: string;
  private readonly _negocioId: string;
  private _nombre: string;
  private _direccion: string | null;
  private _ciudad: string | null;
  private _zonaHoraria: string;
  private _activo: boolean;

  constructor(props: SucursalProps) {
    if (!props.id) throw new Error('El ID de sucursal es obligatorio');
    if (!props.negocioId) throw new Error('El negocioId es obligatorio para aislamiento multi-tenant');
    if (!props.nombre || props.nombre.trim().length === 0) {
      throw new Error('El nombre de la sucursal es obligatorio');
    }

    this._id = props.id;
    this._negocioId = props.negocioId;
    this._nombre = props.nombre.trim();
    this._direccion = props.direccion?.trim() || null;
    this._ciudad = props.ciudad?.trim() || null;
    this._zonaHoraria = props.zonaHoraria?.trim() || 'America/Bogota';
    this._activo = props.activo !== undefined ? props.activo : true;
  }

  get id(): string {
    return this._id;
  }

  get negocioId(): string {
    return this._negocioId;
  }

  get nombre(): string {
    return this._nombre;
  }

  get direccion(): string | null {
    return this._direccion;
  }

  get ciudad(): string | null {
    return this._ciudad;
  }

  get zonaHoraria(): string {
    return this._zonaHoraria;
  }

  get activo(): boolean {
    return this._activo;
  }

  public actualizar(datos: {
    nombre?: string;
    direccion?: string | null;
    ciudad?: string | null;
    zonaHoraria?: string;
  }): void {
    if (datos.nombre !== undefined) {
      if (datos.nombre.trim().length === 0) {
        throw new Error('El nombre de la sucursal no puede estar vacío');
      }
      this._nombre = datos.nombre.trim();
    }
    if (datos.direccion !== undefined) {
      this._direccion = datos.direccion?.trim() || null;
    }
    if (datos.ciudad !== undefined) {
      this._ciudad = datos.ciudad?.trim() || null;
    }
    if (datos.zonaHoraria !== undefined) {
      this._zonaHoraria = datos.zonaHoraria.trim() || 'America/Bogota';
    }
  }

  public activar(): void {
    this._activo = true;
  }

  public desactivar(): void {
    this._activo = false;
  }

  public toResponseDto(): SucursalResponseDto {
    return {
      id: this._id,
      negocioId: this._negocioId,
      nombre: this._nombre,
      direccion: this._direccion,
      ciudad: this._ciudad,
      zonaHoraria: this._zonaHoraria,
      activo: this._activo,
    };
  }
}
