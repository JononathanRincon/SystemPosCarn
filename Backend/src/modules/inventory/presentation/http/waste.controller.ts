import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { MermaService } from '../../application/services/merma.service';
import { CreateMermaDto, MermaResultDto } from '../../application/dtos/merma.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('waste')
@UseGuards(AuthGuard, RolesGuard)
export class WasteController {
  constructor(private readonly mermaService: MermaService) {}

  /**
   * Endpoint POST /waste (design.md / EARS-INV-04)
   * Registra merma clasificada por motivo, con descuento de lote y stock.
   */
  @Post()
  @Roles('Administrador', 'Dueño', 'Encargado')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateMermaDto,
    @Req() req: any,
  ): Promise<MermaResultDto> {
    const usuarioId = req.user?.sub || 'user-pos';
    return this.mermaService.registrarMerma(createDto, usuarioId);
  }

  /**
   * Endpoint GET /waste?sucursal_id=uuid
   */
  @Get()
  async findByBranch(@Query('sucursal_id') sucursalId: string) {
    return this.mermaService.consultarMermasPorSucursal(sucursalId);
  }
}
