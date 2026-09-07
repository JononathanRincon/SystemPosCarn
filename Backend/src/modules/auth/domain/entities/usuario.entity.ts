import * as bcrypt from 'bcrypt';

export interface UsuarioProps {
  id: string;
  negocioId: string;
  sucursalId?: string | null;
  nombreCompleto: string;
  email: string;
  passwordHash: string;
  pinPosHash: string;
  rol: string;
  activo?: boolean;
}

export interface UsuarioResponseDto {
  id: string;
  negocioId: string;
  sucursalId: string | null;
  nombreCompleto: string;
  email: string;
  rol: string;
  activo: boolean;
}

export class Usuario {
  private readonly _id: string;
  private readonly _negocioId: string;
  private _sucursalId: string | null;
  private _nombreCompleto: string;
  private _email: string;
  private _passwordHash: string;
  private _pinPosHash: string;
  private _rol: string;
  private _activo: boolean;

  constructor(props: UsuarioProps) {
    if (!props.id) throw new Error('El ID de usuario es obligatorio');
    if (!props.negocioId) throw new Error('El negocioId es obligatorio');
    if (!props.nombreCompleto || props.nombreCompleto.trim().length === 0) {
      throw new Error('El nombre completo es obligatorio');
    }
    if (!props.email || !this.isValidEmail(props.email)) {
      throw new Error('El email es inválido o está vacío');
    }
    if (!props.passwordHash) {
      throw new Error('El password_hash es obligatorio');
    }
    if (!props.pinPosHash) {
      throw new Error('El pin_pos_hash es obligatorio');
    }
    if (!props.rol) {
      throw new Error('El rol es obligatorio');
    }

    this._id = props.id;
    this._negocioId = props.negocioId;
    this._sucursalId = props.sucursalId ?? null;
    this._nombreCompleto = props.nombreCompleto.trim();
    this._email = props.email.toLowerCase().trim();
    this._passwordHash = props.passwordHash;
    this._pinPosHash = props.pinPosHash;
    this._rol = props.rol;
    this._activo = props.activo !== undefined ? props.activo : true;
  }

  get id(): string {
    return this._id;
  }

  get negocioId(): string {
    return this._negocioId;
  }

  get sucursalId(): string | null {
    return this._sucursalId;
  }

  get nombreCompleto(): string {
    return this._nombreCompleto;
  }

  get email(): string {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get pinPosHash(): string {
    return this._pinPosHash;
  }

  get rol(): string {
    return this._rol;
  }

  get activo(): boolean {
    return this._activo;
  }

  public activate(): void {
    this._activo = true;
  }

  public deactivate(): void {
    this._activo = false;
  }

  public async validatePassword(plainPassword: string): Promise<boolean> {
    if (!plainPassword) return false;
    return bcrypt.compare(plainPassword, this._passwordHash);
  }

  public async validatePin(plainPin: string): Promise<boolean> {
    if (!Usuario.isValidPinFormat(plainPin)) return false;
    return bcrypt.compare(plainPin, this._pinPosHash);
  }

  public static isValidPinFormat(pin: string): boolean {
    return typeof pin === 'string' && /^\d{4}$/.test(pin);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Retorna una representación segura del usuario para respuestas de API,
   * omitiendo estrictamente cualquier hash de contraseña o PIN (Cybersecurity Guidelines).
   */
  public toResponseDto(): UsuarioResponseDto {
    return {
      id: this._id,
      negocioId: this._negocioId,
      sucursalId: this._sucursalId,
      nombreCompleto: this._nombreCompleto,
      email: this._email,
      rol: this._rol,
      activo: this._activo,
    };
  }
}
