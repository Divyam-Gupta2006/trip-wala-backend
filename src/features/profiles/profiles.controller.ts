import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/db';
import { NotFoundError, ForbiddenError, ConflictError } from '../../core/errors';

// Helper to format flat profile output
function formatProfileResponse(user: any, stats: any) {
  return {
    userId: user.id,
    name: user.name,
    username: user.username || null,
    email: user.email,
    bio: user.profile?.bio || null,
    avatarUrl: user.profile?.avatarUrl || null,
    coverImageUrl: user.profile?.coverImageUrl || null,
    location: user.profile?.location || null,
    interests: user.profile?.interests || [],
    travelStyles: user.profile?.travelStyles || [],
    travelPreferences: user.profile?.travelPreferences || [],
    budgetPreference: user.profile?.budgetPreference || 'balanced',
    trustScore: user.profile?.trustScore ?? 30,
    isIdentityVerified: user.profile?.isIdentityVerified ?? false,
    isPhoneVerified: user.profile?.isPhoneVerified ?? false,
    completedTripsCount: user.profile?.completedTripsCount ?? 0,
    socialAccounts: user.profile?.socialAccounts || [],
    languages: user.profile?.languages || [],
    completedTrips: user.profile?.completedTrips || [],
    futureTrips: user.profile?.futureTrips || [],
    age: user.profile?.age || 18,
    statistics: stats,
  };
}

// Helper to compute user stats dynamically
async function getProfileStats(userId: string) {
  const [completedTrips, hostedTrips, joinedTrips, travelMemoriesCount, ratings] = await Promise.all([
    // Completed Trips Count
    prisma.tripMember.count({
      where: {
        userId,
        trip: {
          OR: [
            { status: 'completed' },
            { endDate: { lt: new Date() } },
          ],
        },
      },
    }),
    // Hosted Trips Count
    prisma.tripMember.count({
      where: {
        userId,
        role: 'organizer',
      },
    }),
    // Joined Trips Count
    prisma.tripMember.count({
      where: {
        userId,
        role: 'member',
      },
    }),
    // Travel Memories Count
    prisma.travelMemory.count({
      where: { userId },
    }),
    // Ratings list
    prisma.rating.findMany({
      where: { rateeId: userId },
      select: {
        reliability: true,
        communication: true,
        respectfulness: true,
        socialCompatibility: true,
        funToTravelWith: true,
        planningContribution: true,
      },
    }),
  ]);

  let ratingsAverage = 0.0;
  if (ratings.length > 0) {
    const totalScore = ratings.reduce((sum, r) => {
      const avg =
        (r.reliability +
          r.communication +
          r.respectfulness +
          r.socialCompatibility +
          r.funToTravelWith +
          r.planningContribution) /
        6;
      return sum + avg;
    }, 0);
    ratingsAverage = parseFloat((totalScore / ratings.length).toFixed(1));
  }

  return {
    completedTrips,
    hostedTrips,
    joinedTrips,
    travelMemoriesCount,
    ratingsCount: ratings.length,
    ratingsAverage,
  };
}

// 1. Get Profile by User ID
export async function getProfileById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        verification: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundError('Profile not found', 'PROFILE_NOT_FOUND');
    }

    const stats = await getProfileStats(user.id);
    const data = formatProfileResponse(user, stats);

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
}

// 2. Update Profile
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    // Authorization: User can only update their own profile
    if (currentUserId !== userId) {
      throw new ForbiddenError('You can only update your own profile', 'FORBIDDEN_PROFILE_UPDATE');
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists || userExists.isDeleted) {
      throw new NotFoundError('User account not found', 'USER_NOT_FOUND');
    }

    const {
      name,
      username,
      bio,
      avatarUrl,
      coverImageUrl,
      location,
      interests,
      travelStyles,
      travelPreferences,
      budgetPreference,
      socialAccounts,
      languages,
      age,
    } = req.body;

    // Check for username uniqueness if provided
    if (username && username !== userExists.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username },
      });
      if (usernameExists) {
        throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
      }
    }

    // Perform database updates in transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update User
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(username && { username }),
        },
      });

      // 2. Update Profile
      const profileData = {
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(location !== undefined && { location }),
        ...(interests !== undefined && { interests }),
        ...(travelStyles !== undefined && { travelStyles }),
        ...(travelPreferences !== undefined && { travelPreferences }),
        ...(budgetPreference !== undefined && { budgetPreference }),
        ...(socialAccounts !== undefined && { socialAccounts }),
        ...(languages !== undefined && { languages }),
        ...(age !== undefined && { age }),
      };

      return tx.user.update({
        where: { id: userId },
        include: {
          profile: true,
          verification: true,
        },
        data: {
          profile: {
            update: profileData,
          },
        },
      });
    });

    const stats = await getProfileStats(updatedUser.id);
    const data = formatProfileResponse(updatedUser, stats);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
}

// 3. Search Profiles
export async function searchProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      query,
      minAge,
      maxAge,
      budgetPreference,
      interests,
      travelStyles,
      languages,
      minTrustScore,
      verifiedOnly,
      page,
      limit,
    } = req.query as any;

    const skip = (page - 1) * limit;

    // Build filters dynamically
    const where: any = {
      isDeleted: false,
    };

    // Text search (name or username)
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Profile filters
    const profileFilters: any = {};

    if (minAge !== undefined || maxAge !== undefined) {
      profileFilters.age = {};
      if (minAge !== undefined) profileFilters.age.gte = minAge;
      if (maxAge !== undefined) profileFilters.age.lte = maxAge;
    }

    if (budgetPreference) {
      profileFilters.budgetPreference = budgetPreference;
    }

    if (minTrustScore !== undefined) {
      profileFilters.trustScore = { gte: minTrustScore };
    }

    if (verifiedOnly === true) {
      profileFilters.OR = [
        { isIdentityVerified: true },
        { isPhoneVerified: true },
      ];
    }

    if (interests && interests.length > 0) {
      profileFilters.interests = {
        hasSome: interests,
      };
    }

    if (travelStyles && travelStyles.length > 0) {
      profileFilters.travelStyles = {
        hasSome: travelStyles,
      };
    }

    if (languages && languages.length > 0) {
      profileFilters.languages = {
        hasSome: languages,
      };
    }

    if (Object.keys(profileFilters).length > 0) {
      where.profile = profileFilters;
    }

    // Query databases
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          verification: true,
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Format list with stats dynamically
    const profiles = await Promise.all(
      users.map(async (u) => {
        const stats = await getProfileStats(u.id);
        return formatProfileResponse(u, stats);
      }),
    );

    res.status(200).json({
      success: true,
      message: 'Profiles retrieved successfully',
      data: {
        profiles,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
