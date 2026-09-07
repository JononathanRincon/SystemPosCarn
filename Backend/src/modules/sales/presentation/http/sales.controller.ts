import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { VentaService } from '../../application/services/venta.service';
import { CreateVentaDto, VoidVentaDto, VentaResponseDto } from '../../application/dtos/venta.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('sales')
@UseGuards(AuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly ventaService: VentaService) {}

  @Post()
  async createSale(@Body() dto: CreateVentaDto): Promise<VentaResponseDto> {
    return this.ventaService.crearVenta(dto);
  }

  @Get(':id')
  async getSaleById(@Param('id') id: string): Promise<VentaResponseDto | null> {
    return this.ventaService.buscarVentaPorId(id);
  }

  @Post(':id/void')
  async voidSale(
    @Param('id') id: string,
    @Body() dto: VoidVentaDto,
  ): Promise<VentaResponseDto> {
    return this.ventaService.anularVenta(id, dto);
  }
}
