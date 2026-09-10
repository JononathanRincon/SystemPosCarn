import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../../domain/entities/usuario.entity';
import { UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port';

/**
 * Repositorio de usuarios en memoria con usuarios precargados para entorno local,
 * pruebas y operación offline-first del servidor.
 */
@Injectable()
export class InMemoryUsuarioRepository implements UsuarioRepositoryPort {
  private readonly usuarios: Map<string, Usuario> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers(): void {
    const passwordHash = bcrypt.hashSync('password123', 10);
    const pinHash1234 = bcrypt.hashSync('1234', 10);
    const pinHash4321 = bcrypt.hashSync('4321', 10);

    const cajero = new Usuario({
      id: 'usr-cajero-01',
      negocioId: 'neg-1',
      sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
      nombreCompleto: 'Carlos Carnicero',
      email: 'cajero@carniceria.com',
      passwordHash,
      pinPosHash: pinHash1234,
      rol: 'Cajero',
      activo: true,
    });

    const cajeroDemo = new Usuario({
      id: 'usr-cajero-02',
      negocioId: 'neg-1',
      sucursalId: 'sucursal-uuid-1',
      nombreCompleto: 'Cajero Mostrador',
      email: 'mostrador@carniceria.com',
      passwordHash,
      pinPosHash: pinHash4321,
      rol: 'Cajero',
      activo: true,
    });

    const dueno = new Usuario({
      id: 'usr-dueno-01',
      negocioId: 'neg-1',
      sucursalId: 'suc-1',
      nombreCompleto: 'Don Roberto Dueño',
      email: 'dueno@carniceria.com',
      passwordHash,
      pinPosHash: pinHash1234,
      rol: 'dueno',
      activo: true,
    });

    this.usuarios.set(cajero.id, cajero);
    this.usuarios.set(cajeroDemo.id, cajeroDemo);
    this.usuarios.set(dueno.id, dueno);
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarios.get(id) || null;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    for (const usuario of this.usuarios.values()) {
      if (usuario.email.toLowerCase() === email.toLowerCase()) {
        return usuario;
      }
    }
    return null;
  }

  async findByNegocioAndPin(negocioId: string, pin: string): Promise<Usuario | null> {
    for (const usuario of this.usuarios.values()) {
      if (usuario.negocioId === negocioId && (await usuario.validatePin(pin))) {
        return usuario;
      }
    }
    return null;
  }

  async findBySucursal(sucursalId: string): Promise<Usuario[]> {
    const list: Usuario[] = [];
    for (const usuario of this.usuarios.values()) {
      if (usuario.sucursalId === sucursalId) {
        list.push(usuario);
      }
    }
    return list;
  }

  async findBySucursalAndPin(sucursalId: string, pin: string): Promise<Usuario | null> {
    for (const usuario of this.usuarios.values()) {
      if (usuario.sucursalId === sucursalId && (await usuario.validatePin(pin))) {
        return usuario;
      }
    }
    return null;
  }

  async save(usuario: Usuario): Promise<Usuario> {
    this.usuarios.set(usuario.id, usuario);
    return usuario;
  }
}
