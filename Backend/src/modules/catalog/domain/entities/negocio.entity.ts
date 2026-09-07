export type PlanNegocio = 'basico' | 'pro' | 'enterprise';

export interface NegocioProps {
  id: string;
  nombreComercial: string;
  razonSocial: string;
  nitRut: string;
  plan?: PlanNegocio;
  activo?: boolean;
  fechaRegistro?: Date;
}

export interface NegocioResponseDto {
  id: string;
  nombreComercial: string;
  razonSocial: string;
  nitRut: string;
  plan: PlanNegocio;
  activo: boolean;
  fechaRegistro: Date;
}

export class Negocio {
  private readonly _id: string;
  private _nombreComercial: string;
  private _razonSocial: string;
  private readonly _nitRut: string;
  private _plan: PlanNegocio;
  private _activo: boolean;
  private readonly _fechaRegistro: Date;

  constructor(props: NegocioProps) {
    if (!props.id) throw new Error('El ID de negocio es obligatorio');
    if (!props.nombreComercial || props.nombreComercial.trim().length === 0) {
      throw new Error('El nombre comercial es obligatorio');
    }
    if (!props.razonSocial || props.razonSocial.trim().length === 0) {
      throw new Error('La razón social es obligatoria');
    }
    if (!props.nitRut || props.nitRut.trim().length === 0) {
      throw new Error('El NIT/RUT es obligatorio');
    }

    const plan = props.plan || 'basico';
    if (!['basico', 'pro', 'enterprise'].includes(plan)) {
      throw new Error(`Plan inválido: ${plan}. Los planes permitidos son 'basico', 'pro', 'enterprise'`);
    }

    this._id = props.id;
    this._nombreComercial = props.nombreComercial.trim();
    this._razonSocial = props.razonSocial.trim();
    this._nitRut = props.nitRut.trim();
    this._plan = plan;
    this._activo = props.activo !== undefined ? props.activo : true;
    this._fechaRegistro = props.fechaRegistro || new Date();
  }

  get id(): string {
    return this._id;
  }

  get nombreComercial(): string {
    return this._nombreComercial;
  }

  get razonSocial(): string {
    return this._razonSocial;
  }

  get nitRut(): string {
    return this._nitRut;
  }

  get plan(): PlanNegocio {
    return this._plan;
  }

  get activo(): boolean {
    return this._activo;
  }

  get fechaRegistro(): Date {
    return this._fechaRegistro;
  }

  public actualizarDatos(datos: { nombreComercial?: string; razonSocial?: string; plan?: PlanNegocio }): void {
    if (datos.nombreComercial) {
      if (datos.nombreComercial.trim().length === 0) {
        throw new Error('El nombre comercial no puede estar vacío');
      }
      this._nombreComercial = datos.nombreComercial.trim();
    }

    if (datos.razonSocial) {
      if (datos.razonSocial.trim().length === 0) {
        throw new Error('La razón social no puede estar vacía');
      }
      this._razonSocial = datos.razonSocial.trim();
    }

    if (datos.plan) {
      if (!['basico', 'pro', 'enterprise'].includes(datos.plan)) {
        throw new Error(`Plan inválido: ${datos.plan}`);
      }
      this._plan = datos.plan;
    }
  }

  public activar(): void {
    this._activo = true;
  }

  public desactivar(): void {
    this._activo = false;
  }

  public toResponseDto(): NegocioResponseDto {
    return {
      id: this._id,
      nombreComercial: this._nombreComercial,
      razonSocial: this._razonSocial,
      nitRut: this._nitRut,
      plan: this._plan,
      activo: this._activo,
      fechaRegistro: this._fechaRegistro,
    };
  }
}
