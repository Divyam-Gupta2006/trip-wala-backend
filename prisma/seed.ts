import { PrismaClient, Role, SplitMethod, VerificationStatus, TripStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean old data
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Trip" CASCADE;');

  const passwordHash = bcrypt.hashSync('password123', 10);

  // 1. Create Users
  const userSarah = await prisma.user.create({
    data: {
      id: 'user_sarah_chen',
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      passwordHash,
      profile: {
        create: {
          bio: 'Avid explorer of street food, ancient temple runs, and local cultural hotspots. Fluent in Mandarin & English.',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
          interests: ['Foodie', 'Culture', 'Photography', 'Art'],
          travelStyles: ['Adventure', 'Culture', 'Relaxation'],
          budgetPreference: 'balanced',
          trustScore: 96,
          isIdentityVerified: true,
          isPhoneVerified: true,
          completedTripsCount: 14,
          socialAccounts: ['instagram.com/sarahchen', 'twitter.com/sarahchen_travels'],
          languages: ['English', 'Mandarin', 'Spanish'],
          completedTrips: ['Kyoto temples tour', 'Tokyo culinary escape', 'Hong Kong skyscrapers'],
          futureTrips: ['Bali spiritual getaway'],
          age: 28,
        },
      },
      verification: {
        create: {
          phoneStatus: VerificationStatus.verified,
          governmentIdStatus: VerificationStatus.verified,
          socialStatus: VerificationStatus.verified,
        },
      },
    },
  });

  const userAlex = await prisma.user.create({
    data: {
      id: 'user_alex_rivera',
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      passwordHash,
      profile: {
        create: {
          bio: 'Mountain climber, adrenaline seeker, and digital nomad. Looking for rugged hiking partners.',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
          interests: ['Hiking', 'Adventure', 'Fitness', 'Coffee'],
          travelStyles: ['Adventure', 'Nature'],
          budgetPreference: 'economy',
          trustScore: 92,
          isIdentityVerified: true,
          isPhoneVerified: true,
          completedTripsCount: 22,
          socialAccounts: ['instagram.com/alexrivera_wild'],
          languages: ['English', 'Spanish'],
          completedTrips: ['Swiss Alps traverse', 'Patagonia trekking circuit'],
          futureTrips: ['Leh Ladakh motor expedition'],
          age: 31,
        },
      },
      verification: {
        create: {
          phoneStatus: VerificationStatus.verified,
          governmentIdStatus: VerificationStatus.verified,
          socialStatus: VerificationStatus.verified,
        },
      },
    },
  });

  const userMarcus = await prisma.user.create({
    data: {
      id: 'user_marcus_vance',
      name: 'Marcus Vance',
      email: 'marcus.v@example.com',
      passwordHash,
      profile: {
        create: {
          bio: 'Luxury resort reviewer and travel photographer. Lets enjoy five-star dining and infinity pools.',
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
          interests: ['Luxury', 'Resorts', 'Golf', 'Wine tasting'],
          travelStyles: ['Luxury', 'Relaxation'],
          budgetPreference: 'luxury',
          trustScore: 89,
          isIdentityVerified: false,
          isPhoneVerified: true,
          completedTripsCount: 8,
          socialAccounts: ['linkedin.com/in/marcusvance'],
          languages: ['English', 'French'],
          completedTrips: ['Maldives overwater escape', 'Paris luxury hotel review'],
          futureTrips: ['Amalfi coast cruise'],
          age: 35,
        },
      },
      verification: {
        create: {
          phoneStatus: VerificationStatus.verified,
          governmentIdStatus: VerificationStatus.notStarted,
          socialStatus: VerificationStatus.verified,
        },
      },
    },
  });

  const userSophia = await prisma.user.create({
    data: {
      id: 'user_sophia_martinez',
      name: 'Sophia Martinez',
      email: 'sophia.m@example.com',
      passwordHash,
      profile: {
        create: {
          bio: 'Backpacker doing a gap year across southeast Asia. Traveling on a budget but rich in curiosity.',
          avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
          interests: ['Backpacking', 'Beaches', 'Hostels', 'Volunteering'],
          travelStyles: ['Budget', 'Adventure', 'Nature'],
          budgetPreference: 'economy',
          trustScore: 94,
          isIdentityVerified: true,
          isPhoneVerified: true,
          completedTripsCount: 17,
          socialAccounts: ['instagram.com/sophiatravels_budget'],
          languages: ['English', 'Spanish', 'Portuguese'],
          completedTrips: ['Vietnam motorbike loop', 'Bali volunteer programs'],
          futureTrips: ['Thailand island hopping'],
          age: 23,
        },
      },
      verification: {
        create: {
          phoneStatus: VerificationStatus.verified,
          governmentIdStatus: VerificationStatus.verified,
          socialStatus: VerificationStatus.verified,
        },
      },
    },
  });

  const userJohn = await prisma.user.create({
    data: {
      id: 'user_john_doe',
      name: 'John Doe',
      email: 'john.doe@example.com',
      passwordHash,
      profile: {
        create: {
          bio: 'Tech enthusiast and casual traveler looking for weekend escapes.',
          avatarUrl: null,
          interests: ['Tech', 'Photography', 'Nature'],
          travelStyles: ['Relaxation', 'Culture'],
          budgetPreference: 'balanced',
          trustScore: 85,
          isIdentityVerified: true,
          isPhoneVerified: true,
          completedTripsCount: 3,
          socialAccounts: ['twitter.com/johndoe'],
          languages: ['English'],
          completedTrips: ['Goa beach hopping'],
          futureTrips: [],
          age: 28,
        },
      },
      verification: {
        create: {
          phoneStatus: VerificationStatus.verified,
          governmentIdStatus: VerificationStatus.verified,
          socialStatus: VerificationStatus.notStarted,
        },
      },
    },
  });

  // 2. Create Trips
  const tripBali = await prisma.trip.create({
    data: {
      id: 'trip_bali_123',
      title: 'Bali Beach & Temple Expedition',
      description: 'Join us for a 10-day getaway exploring the spiritual side, beach clubs, and hiking Mt. Batur.',
      origin: 'Mumbai, India',
      destination: 'Bali, Indonesia',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-10T00:00:00.000Z'),
      budgetPreference: 'balanced',
      maxMembers: 6,
      status: TripStatus.open,
      isPublished: true,
      members: {
        create: [
          { userId: userSarah.id, role: Role.organizer },
          { userId: userAlex.id, role: Role.member },
        ],
      },
    },
  });

  const tripSwiss = await prisma.trip.create({
    data: {
      id: 'trip_swiss_789',
      title: 'Swiss Alps Winter Peak Hike',
      description: 'Rugged alpine expedition in Zermatt. Experienced hikers only, aiming to traverse ridge lines.',
      origin: 'Geneva, Switzerland',
      destination: 'Zermatt, Switzerland',
      startDate: new Date('2026-12-15T00:00:00.000Z'),
      endDate: new Date('2026-12-22T00:00:00.000Z'),
      budgetPreference: 'luxury',
      maxMembers: 4,
      status: TripStatus.open,
      isPublished: true,
      members: {
        create: [
          { userId: userMarcus.id, role: Role.organizer },
        ],
      },
    },
  });

  // Create Conversation for Bali Trip
  const conversationBali = await prisma.conversation.create({
    data: {
      id: tripBali.id,
      name: tripBali.title,
      type: 'trip',
      tripId: tripBali.id,
      participants: {
        create: [
          { userId: userSarah.id },
          { userId: userAlex.id },
        ],
      },
    },
  });

  // 3. Create Messages
  await prisma.message.create({
    data: {
      conversationId: conversationBali.id,
      tripId: tripBali.id,
      senderId: userSarah.id,
      senderName: 'Sarah Chen',
      text: 'Hey Alex! Glad to have you on the Bali Trip. Let’s start planning logistics.',
      type: 'text',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversationBali.id,
      tripId: tripBali.id,
      senderId: userAlex.id,
      senderName: 'Alex Rivera',
      text: 'Super excited! I will look up hostels and scooty hires today.',
      type: 'text',
      timestamp: new Date(Date.now() - 1800000), // 30 mins ago
    },
  });

  // 4. Create Expenses
  const villaExpense = await prisma.expense.create({
    data: {
      id: 'exp_bali_villa',
      tripId: tripBali.id,
      title: 'Ubud Jungle Villa Booking',
      totalAmount: 400.00,
      paidById: userSarah.id,
      paidByName: 'Sarah Chen',
      splitMethod: SplitMethod.equal,
      date: new Date(),
      participants: {
        create: [
          { userId: userSarah.id, name: 'Sarah Chen', amount: 200.00, percentage: 50.0 },
          { userId: userAlex.id, name: 'Alex Rivera', amount: 200.00, percentage: 50.0 },
        ],
      },
    },
  });

  // 5. Create Settlements
  await prisma.settlement.create({
    data: {
      tripId: tripBali.id,
      debtorId: userAlex.id,
      debtorName: 'Alex Rivera',
      creditorId: userSarah.id,
      creditorName: 'Sarah Chen',
      amount: 200.00,
      isSettled: false,
    },
  });

  // 6. Create Ratings
  await prisma.rating.create({
    data: {
      tripId: 'trip_goa_completed',
      raterId: userAlex.id,
      rateeId: userSarah.id,
      reliability: 5,
      communication: 5,
      respectfulness: 5,
      socialCompatibility: 4,
      funToTravelWith: 5,
      planningContribution: 5,
    },
  });

  // 7. Create Guardians
  await prisma.guardian.create({
    data: {
      userId: userSarah.id,
      name: 'Michael Chen',
      phone: '+1-555-0199',
      relationship: 'Brother',
      isPrimaryEmergencyContact: true,
    },
  });

  // 8. Create Notifications
  await prisma.notification.create({
    data: {
      userId: userSarah.id,
      title: 'New Trip Invitation',
      body: 'Marcus Vance invited you to join Swiss Alps Winter Peak Hike starting in December.',
      type: 'invitation',
      isRead: false,
      payload: {
        invitationId: 'inv_seed_1',
        tripId: tripSwiss.id,
        inviterId: userMarcus.id,
      },
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
