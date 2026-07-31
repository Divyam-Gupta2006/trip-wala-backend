import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/db';
import { ApiError } from '../../core/errors';

// Helper to format Prisma Trip response to standard JSON contract
export function formatTripResponse(trip: any) {
  return {
    id: trip.id,
    title: trip.title,
    description: trip.description,
    origin: trip.origin,
    destination: trip.destination,
    meetingPoint: trip.meetingPoint,
    imageUrl: trip.imageUrl || '',
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    budget: trip.budget,
    budgetPreference: trip.budgetPreference,
    maxMembers: trip.maxMembers,
    category: trip.category,
    categories: trip.categories,
    difficulty: trip.difficulty,
    languages: trip.languages,
    visibility: trip.visibility,
    requirements: trip.requirements,
    tags: trip.tags,
    isHosted: trip.isHosted,
    itinerary: typeof trip.itinerary === 'string' ? JSON.parse(trip.itinerary) : trip.itinerary,
    status: trip.status,
    isPublished: trip.isPublished,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    members: (trip.members || []).map((m: any) => ({
      userId: m.userId,
      name: m.user.name,
      avatarUrl: m.user.profile?.avatarUrl || null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      trustScore: m.user.profile?.trustScore ?? 30,
      isIdentityVerified: m.user.profile?.isIdentityVerified ?? false,
    })),
  };
}

// 1. Create Trip
export async function createTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const organizerId = req.user!.id;
    const tripData = req.body;

    const newTrip = await prisma.$transaction(async (tx) => {
      // Create trip record
      const trip = await tx.trip.create({
        data: {
          title: tripData.title,
          description: tripData.description,
          origin: tripData.origin,
          destination: tripData.destination,
          meetingPoint: tripData.meetingPoint,
          imageUrl: tripData.imageUrl,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          budget: tripData.budget,
          budgetPreference: tripData.budgetPreference,
          maxMembers: tripData.maxMembers,
          category: tripData.category,
          categories: tripData.categories,
          difficulty: tripData.difficulty,
          languages: tripData.languages,
          visibility: tripData.visibility,
          requirements: tripData.requirements,
          tags: tripData.tags,
          isHosted: tripData.isHosted,
          itinerary: tripData.itinerary ? JSON.stringify(tripData.itinerary) : '[]',
          status: 'open', // defaults to open
          isPublished: tripData.isPublished !== undefined ? tripData.isPublished : true,
        },
      });

      // Automatically add creator as organizer
      await tx.tripMember.create({
        data: {
          tripId: trip.id,
          userId: organizerId,
          role: 'organizer',
        },
      });

      // Automatically create a Conversation for the trip group chat
      await tx.conversation.create({
        data: {
          id: trip.id,
          name: trip.title,
          type: 'trip',
          tripId: trip.id,
          participants: {
            create: [
              { userId: organizerId }
            ]
          }
        }
      });

      return tx.trip.findUnique({
        where: { id: trip.id },
        include: {
          members: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });
    });

    if (!newTrip) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to create trip and retrieve records.');
    }

    return res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      data: formatTripResponse(newTrip),
    });
  } catch (error) {
    next(error);
  }
}

// 2. Get Trip Details
export async function getTripById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist or has been deleted.');
    }

    // Authorization: Check private trip visibility
    if (trip.visibility === 'private') {
      const isMember = trip.members.some(m => m.userId === currentUserId);
      if (!isMember) {
        throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'You do not have permission to view this private trip.');
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Trip details retrieved successfully',
      data: formatTripResponse(trip),
    });
  } catch (error) {
    next(error);
  }
}

// 3. Update Trip
export async function updateTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const updateData = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist or has been deleted.');
    }

    // Permission check: Must be organizer
    const userRole = trip.members.find(m => m.userId === currentUserId)?.role;
    if (userRole !== 'organizer') {
      throw new ApiError(403, 'FORBIDDEN_TRIP_UPDATE', 'Only the trip organizer can modify trip details.');
    }

    // Status transition validation
    if (updateData.status && updateData.status !== trip.status) {
      const current = trip.status;
      const target = updateData.status;

      let isValid = false;
      if (current === 'draft' && (target === 'open' || target === 'cancelled')) isValid = true;
      else if (current === 'open' && (target === 'full' || target === 'inProgress' || target === 'completed' || target === 'cancelled')) isValid = true;
      else if (current === 'full' && (target === 'open' || target === 'inProgress' || target === 'completed' || target === 'cancelled')) isValid = true;
      else if (current === 'inProgress' && (target === 'completed' || target === 'cancelled')) isValid = true;

      if (!isValid) {
        throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot change trip status from '${current}' to '${target}'.`);
      }
    }

    // Handle itinerary serialization if present
    const payload: any = { ...updateData };
    if (updateData.itinerary) {
      payload.itinerary = JSON.stringify(updateData.itinerary);
    }

    const updated = await prisma.trip.update({
      where: { id },
      data: payload,
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Trip updated successfully',
      data: formatTripResponse(updated),
    });
  } catch (error) {
    next(error);
  }
}

// 4. Delete Trip (Soft Delete)
export async function deleteTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist or has been deleted.');
    }

    // Permission check: Must be organizer
    const userRole = trip.members.find(m => m.userId === currentUserId)?.role;
    if (userRole !== 'organizer') {
      throw new ApiError(403, 'FORBIDDEN_TRIP_DELETE', 'Only the trip organizer can delete this trip.');
    }

    await prisma.trip.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: 'cancelled',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Trip deleted successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
}

// 5. Search & Discover Trips
export async function searchTrips(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = req.query as any;

    const where: any = {
      isDeleted: false,
      isPublished: true,
      visibility: 'public',
    };

    if (filters.destination) {
      where.destination = { contains: filters.destination, mode: 'insensitive' };
    }

    if (filters.budgetPreference) {
      where.budgetPreference = filters.budgetPreference;
    }

    if (filters.budget !== undefined) {
      where.budget = { lte: filters.budget };
    }

    if (filters.startDate) {
      where.startDate = { gte: filters.startDate };
    }

    if (filters.endDate) {
      where.endDate = { lte: filters.endDate };
    }

    if (filters.isHosted !== undefined) {
      where.isHosted = filters.isHosted;
    }

    if (filters.category) {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }

    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }

    if (filters.status) {
      where.status = filters.status;
    } else {
      // Default behavior: Don't show completed or cancelled in basic search
      where.status = { notIn: ['completed', 'cancelled'] };
    }

    // Filter by organizer trust score
    if (filters.minTrustScore !== undefined) {
      where.members = {
        some: {
          role: 'organizer',
          user: {
            profile: {
              trustScore: {
                gte: filters.minTrustScore,
              },
            },
          },
        },
      };
    }

    // Filter by languages
    if (filters.languages && filters.languages.length > 0) {
      where.languages = {
        hasSome: filters.languages,
      };
    }

    // Prisma dynamic sorting
    const orderBy: any = {};
    orderBy[filters.sortBy] = filters.sortOrder;

    // Fetch matching records (unpaginated count for exact totals)
    const rawTrips = await prisma.trip.findMany({
      where,
      orderBy,
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    // Available seats local array filtering
    let matchedTrips = rawTrips;
    if (filters.availableSeats === true) {
      matchedTrips = rawTrips.filter(t => t.members.length < t.maxMembers);
    }

    // In-memory pagination calculation to account for seat filters
    const totalCount = matchedTrips.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const paginatedTrips = matchedTrips.slice(startIndex, startIndex + filters.limit);

    const formatted = paginatedTrips.map(formatTripResponse);

    return res.status(200).json({
      success: true,
      message: 'Trips discovered successfully',
      data: {
        trips: formatted,
        pagination: {
          totalCount,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(totalCount / filters.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// 6. Get User Trips (All, Hosted, Joined)
export async function getUserTrips(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId === 'me' ? req.user!.id : req.params.userId;
    const filterType = req.path.endsWith('/hosted') ? 'hosted' : req.path.endsWith('/joined') ? 'joined' : 'all';

    // Verify user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists || userExists.isDeleted) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User does not exist.');
    }

    const memberFilter: any = { userId };
    if (filterType === 'hosted') {
      memberFilter.role = 'organizer';
    } else if (filterType === 'joined') {
      memberFilter.role = { in: ['member', 'coOrganizer'] };
    }

    const trips = await prisma.trip.findMany({
      where: {
        isDeleted: false,
        members: {
          some: memberFilter,
        },
      },
      orderBy: { startDate: 'asc' },
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User trips retrieved successfully',
      data: trips.map(formatTripResponse),
    });
  } catch (error) {
    next(error);
  }
}
