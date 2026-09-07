export interface CategoriaProps {
  id: string;
  negocioId: string;
  nombre: string;
  ordenVisualizacion?: number;
}

export interface CategoriaResponseDto {
  id: string;
  negocioId: string;
  nombre: string;
  ordenVisualizacion: number;
}

export class Categoria {
  private readonly _id: string;
  private readonly _negocioId: string;
  private _nombre: string;
  private _ordenVisualizacion: number;

  constructor(props: CategoriaProps) {
    if (!props.id) throw new Error('El ID de categoría es obligatorio');
    if (!props.negocioId) throw new Error('El negocioId es obligatorio para aislamiento multi-tenant');
    if (!props.nombre || props.nombre.trim().length === 0) {
      throw new Error('El nombre de la categoría es obligatorio');
    }

    this._id = props.id;
    this._negocioId = props.negocioId;
    this._nombre = props.nombre.trim();
    this._ordenVisualizacion = props.ordenVisualizacion !== undefined ? props.ordenVisualizacion : 0;
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

  get ordenVisualizacion(): number {
    return this._ordenVisualizacion;
  }

  public actualizar(datos: { nombre?: string; ordenVisualizacion?: number }): void {
    if (datos.nombre !== undefined) {
      if (datos.nombre.trim().length === 0) {
        throw new Error('El nombre de la categoría no puede estar vacío');
      }
      this._nombre = datos.nombre.trim();
    }
    if (datos.ordenVisualizacion !== undefined) {
      this._ordenVisualizacion = datos.ordenVisualizacion;
    }
  }

  public toResponseDto(): CategoriaResponseDto {
    return {
      id: this._id,
      negocioId: this._negocioId,
      nombre: this._nombre,
      ordenVisualizacion: this._ordenVisualizacion,
    };
  }
}
