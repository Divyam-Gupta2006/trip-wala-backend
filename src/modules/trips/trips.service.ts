import { prisma } from '../../shared/database/prisma';
import { CreateTripInput, UpdateTripInput } from './trips.dto';

export class TripsService {
  async getTrips(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;
    
    const whereClause = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { destination: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: {
            select: { id: true, name: true, profile: { select: { avatarUrl: true } } },
          },
          _count: {
            select: { members: true },
          },
        },
      }),
      prisma.trip.count({ where: whereClause }),
    ]);

    return { trips, total, page, limit };
  }

  async getTripById(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        organizer: { select: { id: true, name: true, trustScore: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } },
          },
        },
      },
    });

    if (!trip) throw { status: 404, message: 'Trip not found' };
    return trip;
  }

  async createTrip(userId: string, data: CreateTripInput) {
    const trip = await prisma.trip.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        organizerId: userId,
        members: {
          create: {
            userId,
            role: 'ORGANIZER',
          },
        },
      },
    });

    return trip;
  }

  async updateTrip(userId: string, tripId: string, data: UpdateTripInput) {
    // Check ownership
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw { status: 404, message: 'Trip not found' };
    if (trip.organizerId !== userId) throw { status: 403, message: 'Not authorized to edit this trip' };

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    return updatedTrip;
  }

  async deleteTrip(userId: string, tripId: string) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw { status: 404, message: 'Trip not found' };
    if (trip.organizerId !== userId) throw { status: 403, message: 'Not authorized to delete this trip' };

    await prisma.trip.delete({ where: { id: tripId } });
    return { success: true };
  }
}
