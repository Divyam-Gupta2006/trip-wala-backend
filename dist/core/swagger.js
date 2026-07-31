"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const config_1 = require("./config");
exports.swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Trip Wala Backend API',
        version: '1.0.0',
        description: 'Production API specification for Trip Wala companion travel platform backend.',
    },
    servers: [
        {
            url: `http://localhost:${config_1.config.PORT}/api/v1`,
            description: 'Local Development Server',
        },
    ],
    paths: {
        '/health/live': {
            get: {
                summary: 'Process is running',
                tags: ['Health'],
                responses: {
                    200: {
                        description: 'Uptime and process status success response',
                    },
                },
            },
        },
        '/health/ready': {
            get: {
                summary: 'PostgreSQL and Redis check',
                tags: ['Health'],
                responses: {
                    200: {
                        description: 'Database and Redis connected successfully',
                    },
                    503: {
                        description: 'One or more backing services failed to respond',
                    },
                },
            },
        },
        '/auth/register': {
            post: {
                summary: 'Create traveler profile',
                tags: ['Authentication'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'email', 'password'],
                                properties: {
                                    name: { type: 'string', example: 'Sarah Chen' },
                                    email: { type: 'string', example: 'sarah.chen@example.com' },
                                    password: { type: 'string', example: 'password123' },
                                    age: { type: 'number', example: 28 },
                                    deviceId: { type: 'string', example: 'device-uuid-123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Created successfully',
                    },
                    400: {
                        description: 'Validation failed',
                    },
                    409: {
                        description: 'Email already registered',
                    },
                },
            },
        },
        '/auth/login': {
            post: {
                summary: 'Authenticate credentials',
                tags: ['Authentication'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', example: 'sarah.chen@example.com' },
                                    password: { type: 'string', example: 'password123' },
                                    deviceId: { type: 'string', example: 'device-uuid-123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Logged in successfully',
                    },
                    401: {
                        description: 'Invalid credentials',
                    },
                },
            },
        },
        '/auth/refresh': {
            post: {
                summary: 'Rotate refresh token',
                tags: ['Authentication'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: {
                                    refreshToken: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Tokens refreshed',
                    },
                    401: {
                        description: 'Token expired or invalid',
                    },
                },
            },
        },
        '/auth/logout': {
            post: {
                summary: 'Terminate current session',
                tags: ['Authentication'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Session ended successfully',
                    },
                },
            },
        },
        '/users/me': {
            get: {
                summary: 'Get active profile',
                tags: ['Users'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Returned active user details',
                    },
                    401: {
                        description: 'Unauthorized access',
                    },
                },
            },
        },
        '/users/{id}': {
            get: {
                summary: 'Get user by ID',
                tags: ['Users'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User retrieved successfully' },
                    404: { description: 'User not found' },
                },
            },
            delete: {
                summary: 'Soft-delete user account',
                tags: ['Users'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User account deleted successfully' },
                    403: { description: 'Cannot delete other user accounts' },
                    404: { description: 'User not found' },
                },
            },
        },
        '/profiles': {
            get: {
                summary: 'Search and filter traveler profiles',
                tags: ['Profiles'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'query', in: 'query', schema: { type: 'string' } },
                    { name: 'minAge', in: 'query', schema: { type: 'integer' } },
                    { name: 'maxAge', in: 'query', schema: { type: 'integer' } },
                    { name: 'budgetPreference', in: 'query', schema: { type: 'string', enum: ['budget', 'balanced', 'luxury'] } },
                    { name: 'interests', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
                    { name: 'travelStyles', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
                    { name: 'languages', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
                    { name: 'minTrustScore', in: 'query', schema: { type: 'integer' } },
                    { name: 'verifiedOnly', in: 'query', schema: { type: 'boolean' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'List of matching profiles returned successfully' },
                },
            },
        },
        '/profiles/{userId}': {
            get: {
                summary: 'Get public flat profile by user ID',
                tags: ['Profiles'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'userId',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'Flat profile retrieved successfully' },
                    404: { description: 'Profile not found' },
                },
            },
            put: {
                summary: 'Update user profile details',
                tags: ['Profiles'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'userId',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    username: { type: 'string' },
                                    bio: { type: 'string' },
                                    avatarUrl: { type: 'string' },
                                    coverImageUrl: { type: 'string' },
                                    location: { type: 'string' },
                                    interests: { type: 'array', items: { type: 'string' } },
                                    travelStyles: { type: 'array', items: { type: 'string' } },
                                    travelPreferences: { type: 'array', items: { type: 'string' } },
                                    budgetPreference: { type: 'string', enum: ['budget', 'balanced', 'luxury'] },
                                    socialAccounts: { type: 'array', items: { type: 'string' } },
                                    languages: { type: 'array', items: { type: 'string' } },
                                    age: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Profile updated successfully' },
                    403: { description: 'Cannot update other user profiles' },
                    404: { description: 'Profile not found' },
                    409: { description: 'Username already taken' },
                },
            },
        },
        '/trips': {
            post: {
                summary: 'Create traveler trip',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['title', 'description', 'origin', 'destination', 'startDate', 'endDate', 'maxMembers'],
                                properties: {
                                    title: { type: 'string', example: 'Bali Adventure' },
                                    description: { type: 'string', example: 'Surf and beaches trip.' },
                                    origin: { type: 'string', example: 'Seattle, USA' },
                                    destination: { type: 'string', example: 'Bali, Indonesia' },
                                    meetingPoint: { type: 'string', example: 'Airport Terminal 1' },
                                    imageUrl: { type: 'string', example: 'https://example.com/bali.jpg' },
                                    startDate: { type: 'string', format: 'date-time', example: '2026-08-01T00:00:00Z' },
                                    endDate: { type: 'string', format: 'date-time', example: '2026-08-10T00:00:00Z' },
                                    budget: { type: 'number', example: 1200 },
                                    budgetPreference: { type: 'string', enum: ['budget', 'balanced', 'luxury'], example: 'balanced' },
                                    maxMembers: { type: 'integer', example: 6 },
                                    category: { type: 'string', example: 'Adventure' },
                                    categories: { type: 'array', items: { type: 'string' } },
                                    difficulty: { type: 'string', example: 'easy' },
                                    languages: { type: 'array', items: { type: 'string' } },
                                    visibility: { type: 'string', enum: ['public', 'private'], example: 'public' },
                                    requirements: { type: 'array', items: { type: 'string' } },
                                    tags: { type: 'array', items: { type: 'string' } },
                                    isHosted: { type: 'boolean', example: false },
                                    itinerary: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            required: ['dayNumber', 'title'],
                                            properties: {
                                                dayNumber: { type: 'integer' },
                                                title: { type: 'string' },
                                                description: { type: 'string' },
                                                activities: { type: 'array', items: { type: 'string' } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Trip created successfully' },
                    400: { description: 'Validation failed' },
                },
            },
            get: {
                summary: 'Search & discover public trips',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'destination', in: 'query', schema: { type: 'string' } },
                    { name: 'budget', in: 'query', schema: { type: 'number' } },
                    { name: 'budgetPreference', in: 'query', schema: { type: 'string', enum: ['budget', 'balanced', 'luxury'] } },
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'isHosted', in: 'query', schema: { type: 'boolean' } },
                    { name: 'category', in: 'query', schema: { type: 'string' } },
                    { name: 'difficulty', in: 'query', schema: { type: 'string' } },
                    { name: 'languages', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
                    { name: 'minTrustScore', in: 'query', schema: { type: 'integer' } },
                    { name: 'availableSeats', in: 'query', schema: { type: 'boolean' } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'open', 'full', 'inProgress', 'completed', 'cancelled'] } },
                    { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['startDate', 'budget', 'createdAt'], default: 'createdAt' } },
                    { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'List of matching public trips returned' },
                },
            },
        },
        '/trips/{id}': {
            get: {
                summary: 'Get details of a trip',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Trip details retrieved' },
                    403: { description: 'Forbidden access to private trip' },
                    404: { description: 'Trip not found' },
                },
            },
            put: {
                summary: 'Update trip details',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    origin: { type: 'string' },
                                    destination: { type: 'string' },
                                    meetingPoint: { type: 'string' },
                                    imageUrl: { type: 'string' },
                                    startDate: { type: 'string', format: 'date-time' },
                                    endDate: { type: 'string', format: 'date-time' },
                                    budget: { type: 'number' },
                                    budgetPreference: { type: 'string', enum: ['budget', 'balanced', 'luxury'] },
                                    maxMembers: { type: 'integer' },
                                    category: { type: 'string' },
                                    categories: { type: 'array', items: { type: 'string' } },
                                    difficulty: { type: 'string' },
                                    languages: { type: 'array', items: { type: 'string' } },
                                    visibility: { type: 'string', enum: ['public', 'private'] },
                                    requirements: { type: 'array', items: { type: 'string' } },
                                    tags: { type: 'array', items: { type: 'string' } },
                                    isHosted: { type: 'boolean' },
                                    itinerary: { type: 'array', items: { type: 'object' } },
                                    status: { type: 'string', enum: ['draft', 'open', 'full', 'inProgress', 'completed', 'cancelled'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Trip updated successfully' },
                    403: { description: 'Not authorized or not the organizer' },
                    404: { description: 'Trip not found' },
                },
            },
            delete: {
                summary: 'Soft-delete a trip',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Trip deleted successfully' },
                    403: { description: 'Not authorized or not the organizer' },
                    404: { description: 'Trip not found' },
                },
            },
        },
        '/trips/user/{userId}': {
            get: {
                summary: 'Get all trips where the user is a member',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: "Use 'me' for active user" }],
                responses: {
                    200: { description: 'User trips retrieved successfully' },
                },
            },
        },
        '/trips/user/{userId}/hosted': {
            get: {
                summary: 'Get trips organized/hosted by the user',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Hosted trips retrieved successfully' },
                },
            },
        },
        '/trips/user/{userId}/joined': {
            get: {
                summary: 'Get trips joined by the user (as a member)',
                tags: ['Trips'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Joined trips retrieved successfully' },
                },
            },
        },
        '/trips/{tripId}/applications': {
            post: {
                summary: 'Apply to join a trip',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', example: 'I would love to join your trip!' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Application submitted successfully' },
                    400: { description: 'Bad request (trip full, duplicate, or invalid state)' },
                },
            },
            get: {
                summary: 'View applications for a trip (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'cancelled'] } },
                ],
                responses: {
                    200: { description: 'List of applications returned' },
                    403: { description: 'Only organizers can access' },
                },
            },
        },
        '/applications/me': {
            get: {
                summary: 'View my own trip applications',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'List of my applications returned' },
                },
            },
        },
        '/applications/{id}': {
            get: {
                summary: 'Get application details',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Application details returned' },
                    403: { description: 'Access denied' },
                    404: { description: 'Application not found' },
                },
            },
        },
        '/applications/{id}/cancel': {
            post: {
                summary: 'Cancel a pending application',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Application cancelled successfully' },
                },
            },
        },
        '/applications/{id}/accept': {
            post: {
                summary: 'Accept a trip application (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reviewNotes: { type: 'string', example: 'Welcome!' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Application accepted successfully' },
                },
            },
        },
        '/applications/{id}/reject': {
            post: {
                summary: 'Reject a trip application (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reviewNotes: { type: 'string', example: 'Sorry, not compatible.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Application rejected successfully' },
                },
            },
        },
        '/trips/{tripId}/invitations': {
            post: {
                summary: 'Invite a user to a trip (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['inviteeId'],
                                properties: {
                                    inviteeId: { type: 'string', format: 'uuid' },
                                    role: { type: 'string', enum: ['organizer', 'coOrganizer', 'member'], default: 'member' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Invitation sent successfully' },
                },
            },
        },
        '/invitations/sent': {
            get: {
                summary: 'View invitations sent by me',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'List of sent invitations returned' },
                },
            },
        },
        '/invitations/received': {
            get: {
                summary: 'View invitations received by me',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'List of received invitations returned' },
                },
            },
        },
        '/invitations/{id}/cancel': {
            post: {
                summary: 'Cancel an invitation (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Invitation cancelled successfully' },
                },
            },
        },
        '/invitations/{id}/accept': {
            post: {
                summary: 'Accept an invitation',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Invitation accepted successfully' },
                },
            },
        },
        '/invitations/{id}/decline': {
            post: {
                summary: 'Decline an invitation',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Invitation declined successfully' },
                },
            },
        },
        '/trips/{tripId}/members': {
            post: {
                summary: 'Add member directly (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['userId'],
                                properties: {
                                    userId: { type: 'string', format: 'uuid' },
                                    role: { type: 'string', enum: ['organizer', 'coOrganizer', 'member'], default: 'member' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Member added directly' },
                },
            },
        },
        '/trips/{tripId}/members/{userId}': {
            delete: {
                summary: 'Remove member from a trip (organizers only)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Member removed successfully' },
                },
            },
        },
        '/trips/{tripId}/leave': {
            post: {
                summary: 'Leave a trip',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Left the trip successfully' },
                },
            },
        },
        '/trips/{tripId}/members/{userId}/role': {
            patch: {
                summary: 'Update member role (promote to coOrganizer or transfer ownership)',
                tags: ['Memberships'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['role'],
                                properties: {
                                    role: { type: 'string', enum: ['organizer', 'coOrganizer', 'member'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Member role updated successfully' },
                },
            },
        },
        '/conversations': {
            get: {
                summary: 'List user conversations',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Conversations retrieved successfully' },
                },
            },
        },
        '/conversations/unread-count': {
            get: {
                summary: 'Get total unread counts',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Unread counts retrieved successfully' },
                },
            },
        },
        '/conversations/direct': {
            post: {
                summary: 'Get or create direct conversation with target user',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['targetUserId'],
                                properties: {
                                    targetUserId: { type: 'string', format: 'uuid' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Direct conversation resolved successfully' },
                },
            },
        },
        '/conversations/{id}': {
            get: {
                summary: 'Get conversation details',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Conversation details retrieved successfully' },
                },
            },
        },
        '/conversations/{id}/read': {
            post: {
                summary: 'Mark conversation as read',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Conversation marked as read successfully' },
                },
            },
        },
        '/conversations/{id}/messages': {
            get: {
                summary: 'Get conversation message history',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'cursor', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Message history retrieved successfully' },
                },
            },
            post: {
                summary: 'Send a message in conversation',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['text'],
                                properties: {
                                    text: { type: 'string' },
                                    imageUrl: { type: 'string' },
                                    filePath: { type: 'string' },
                                    replyToMessageId: { type: 'string' },
                                    replyToMessageText: { type: 'string' },
                                    replyToMessageSender: { type: 'string' },
                                    mentions: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Message sent successfully' },
                },
            },
        },
        '/conversations/messages/{messageId}': {
            put: {
                summary: 'Edit a message text',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['text'],
                                properties: {
                                    text: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Message edited successfully' },
                },
            },
            delete: {
                summary: 'Soft delete a message',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Message deleted successfully' },
                },
            },
        },
        '/conversations/messages/{messageId}/react': {
            post: {
                summary: 'Toggle emoji reaction on message',
                tags: ['Messaging'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['emoji'],
                                properties: {
                                    emoji: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Reaction toggled successfully' },
                },
            },
        },
        '/trust/score': {
            get: {
                summary: 'Get current user trust score breakdown',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Breakdown of trust score factors' },
                },
            },
        },
        '/trust/score/{userId}': {
            get: {
                summary: 'Get target user trust score breakdown',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Target user trust score breakdown' },
                },
            },
        },
        '/trust/score/sync': {
            post: {
                summary: 'Synchronize and save current user trust score',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Synchronized trust score successfully' },
                },
            },
        },
        '/trust/ratings': {
            post: {
                summary: 'Submit traveler rating for a completed trip',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['tripId', 'rateeId', 'reliability', 'communication', 'respectfulness', 'socialCompatibility', 'funToTravelWith', 'planningContribution'],
                                properties: {
                                    tripId: { type: 'string' },
                                    rateeId: { type: 'string' },
                                    reliability: { type: 'integer', minimum: 1, maximum: 5 },
                                    communication: { type: 'integer', minimum: 1, maximum: 5 },
                                    respectfulness: { type: 'integer', minimum: 1, maximum: 5 },
                                    socialCompatibility: { type: 'integer', minimum: 1, maximum: 5 },
                                    funToTravelWith: { type: 'integer', minimum: 1, maximum: 5 },
                                    planningContribution: { type: 'integer', minimum: 1, maximum: 5 },
                                    review: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Rating created successfully' },
                    400: { description: 'Self rating or incomplete trip' },
                    409: { description: 'Duplicate rating' },
                },
            },
        },
        '/trust/ratings/user/{userId}': {
            get: {
                summary: 'List ratings received by a traveler',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'cursor', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'List of ratings' },
                },
            },
        },
        '/trust/ratings/user/{userId}/analytics': {
            get: {
                summary: 'Get traveler ratings average and distribution analytics',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Averages by category and score distributions' },
                },
            },
        },
        '/trust/verification': {
            get: {
                summary: 'Get current user identity verification status',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Verification states' },
                },
            },
        },
        '/trust/verification/request': {
            post: {
                summary: 'Submit verification request',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['type'],
                                properties: {
                                    type: { type: 'string', enum: ['phone', 'governmentId', 'social'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Verification state updated to pending' },
                },
            },
        },
        '/trust/verification/{userId}/status': {
            put: {
                summary: 'Admin workflow to update verification status',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['type', 'status'],
                                properties: {
                                    type: { type: 'string', enum: ['phone', 'governmentId', 'social'] },
                                    status: { type: 'string', enum: ['notStarted', 'pending', 'verified'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Verification state updated and trust score synced' },
                },
            },
        },
        '/trust/guardians': {
            get: {
                summary: 'List emergency guardians',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'List of emergency contacts' },
                },
            },
            post: {
                summary: 'Add trusted guardian',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'phone', 'relationship'],
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    relationship: { type: 'string' },
                                    email: { type: 'string' },
                                    notes: { type: 'string' },
                                    isPrimaryEmergencyContact: { type: 'boolean', default: false },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Guardian created successfully' },
                },
            },
        },
        '/trust/guardians/{id}': {
            put: {
                summary: 'Update guardian details',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    relationship: { type: 'string' },
                                    email: { type: 'string' },
                                    notes: { type: 'string' },
                                    isPrimaryEmergencyContact: { type: 'boolean' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Guardian updated' },
                },
            },
            delete: {
                summary: 'Remove guardian contact',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Guardian deleted' },
                },
            },
        },
        '/trust/memories': {
            post: {
                summary: 'Add new travel memory',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['title', 'description'],
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    destination: { type: 'string' },
                                    tripId: { type: 'string' },
                                    mediaUrl: { type: 'string' },
                                    mediaUrls: { type: 'array', items: { type: 'string' } },
                                    visibility: { type: 'string', enum: ['public', 'friends', 'private'], default: 'public' },
                                    date: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Memory created successfully' },
                },
            },
        },
        '/trust/memories/user/{userId}': {
            get: {
                summary: 'List travel memories of a specific user',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'cursor', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'List of visible memories' },
                },
            },
        },
        '/trust/memories/{id}': {
            put: {
                summary: 'Update travel memory details',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    destination: { type: 'string' },
                                    tripId: { type: 'string' },
                                    mediaUrl: { type: 'string' },
                                    mediaUrls: { type: 'array', items: { type: 'string' } },
                                    visibility: { type: 'string', enum: ['public', 'friends', 'private'] },
                                    date: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Travel memory updated' },
                },
            },
            delete: {
                summary: 'Delete travel memory',
                tags: ['Trust & Safety'],
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Travel memory deleted' },
                },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
};
