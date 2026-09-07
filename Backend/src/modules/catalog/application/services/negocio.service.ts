import {
  Injectable,
  Inject,
  Optional,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Negocio, NegocioResponseDto } from '../../domain/entities/negocio.entity';
import {
  NegocioRepositoryPort,
  NEGOCIO_REPOSITORY_PORT,
} from '../../domain/ports/negocio-repository.port';
import { CreateNegocioDto, UpdateNegocioDto } from '../dtos/negocio.dto';

@Injectable()
export class NegocioService {
  constructor(
    @Optional()
    @Inject(NEGOCIO_REPOSITORY_PORT)
    private readonly negocioRepository?: NegocioRepositoryPort,
  ) {}

  /**
   * Registra un nuevo Negocio (Tenant Maestro).
   * Valida unicidad de NIT/RUT para prevenir duplicados.
   */
  async create(dto: CreateNegocioDto): Promise<NegocioResponseDto> {
    if (!this.negocioRepository) {
      throw new Error('NegocioRepositoryPort no inyectado');
    }

    const nitLimpio = dto.nitRut.trim();
    const existe = await this.negocioRepository.findByNit(nitLimpio);
    if (existe) {
      throw new ConflictException(`Ya existe un negocio registrado con el NIT/RUT ${nitLimpio}`);
    }

    const nuevoNegocio = new Negocio({
      id: crypto.randomUUID(),
      nombreComercial: dto.nombreComercial,
      razonSocial: dto.razonSocial,
      nitRut: nitLimpio,
      plan: dto.plan || 'basico',
      activo: true,
      fechaRegistro: new Date(),
    });

    const guardado = await this.negocioRepository.save(nuevoNegocio);
    return guardado.toResponseDto();
  }

  /**
   * Consulta un negocio por su identificador UUID.
   */
  async findById(id: string): Promise<NegocioResponseDto> {
    if (!this.negocioRepository) {
      throw new Error('NegocioRepositoryPort no inyectado');
    }

    const negocio = await this.negocioRepository.findById(id);
    if (!negocio) {
      throw new NotFoundException(`Negocio con ID ${id} no encontrado`);
    }

    return negocio.toResponseDto();
  }

  /**
   * Actualiza los datos comerciales de un negocio.
   */
  async update(id: string, dto: UpdateNegocioDto): Promise<NegocioResponseDto> {
    if (!this.negocioRepository) {
      throw new Error('NegocioRepositoryPort no inyectado');
    }

    const negocio = await this.negocioRepository.findById(id);
    if (!negocio) {
      throw new NotFoundException(`Negocio con ID ${id} no encontrado`);
    }

    negocio.actualizarDatos({
      nombreComercial: dto.nombreComercial,
      razonSocial: dto.razonSocial,
      plan: dto.plan,
    });

    const guardado = await this.negocioRepository.save(negocio);
    return guardado.toResponseDto();
  }

  /**
   * Desactiva un negocio.
   */
  async deactivate(id: string): Promise<NegocioResponseDto> {
    if (!this.negocioRepository) {
      throw new Error('NegocioRepositoryPort no inyectado');
    }

    const negocio = await this.negocioRepository.findById(id);
    if (!negocio) {
      throw new NotFoundException(`Negocio con ID ${id} no encontrado`);
    }

    negocio.desactivar();
    const guardado = await this.negocioRepository.save(negocio);
    return guardado.toResponseDto();
  }

  /**
   * Lista todos los negocios registrados.
   */
  async findAll(): Promise<NegocioResponseDto[]> {
    if (!this.negocioRepository) {
      throw new Error('NegocioRepositoryPort no inyectado');
    }

    const negocios = await this.negocioRepository.findAll();
    return negocios.map((n) => n.toResponseDto());
  }
}
