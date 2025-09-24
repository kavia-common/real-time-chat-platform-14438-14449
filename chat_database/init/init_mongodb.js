//
// MongoDB initialization script for real-time chat application
// Creates collections: users, channels, messages
// Adds JSON Schema validators, indexes, and example relationships
//
// Usage (from container host with mongosh available and DB running):
//   mongosh "mongodb://appuser:dbuser123@localhost:5000/myapp?authSource=admin" --file ./chat_database/init/init_mongodb.js
//
// Note: Values for DB name/URL are examples; prefer using environment variables and startup scripts to connect.
//

(function () {
  // PUBLIC_INTERFACE
  /**
   * Initializes the database by creating collections with validators and indexes.
   * This script is idempotent: it checks for existing collections and indexes.
   */
  function initializeChatDatabase() {
    const dbName = db.getName();

    // Helper to check if a collection exists
    function collectionExists(name) {
      return db.getCollectionNames().includes(name);
    }

    // USERS COLLECTION
    // Schema overview:
    // - _id: ObjectId
    // - username: string (unique, normalized)
    // - email: string (unique, normalized)
    // - displayName: string
    // - avatarUrl: string (optional)
    // - status: string enum ['online','offline','away','dnd'] default 'offline'
    // - createdAt: date
    // - updatedAt: date
    // - profile: { bio?: string, timezone?: string }
    const usersCollectionName = "users";
    const usersValidator = {
      $jsonSchema: {
        bsonType: "object",
        required: ["username", "email", "displayName", "createdAt", "updatedAt", "status"],
        additionalProperties: true,
        properties: {
          _id: { bsonType: "objectId" },
          username: {
            bsonType: "string",
            description: "Unique username; lowercased and trimmed"
          },
          email: {
            bsonType: "string",
            description: "Unique email; lowercased and trimmed"
          },
          displayName: { bsonType: "string" },
          avatarUrl: { bsonType: ["string", "null"] },
          status: {
            enum: ["online", "offline", "away", "dnd"],
            description: "Presence status"
          },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
          profile: {
            bsonType: "object",
            additionalProperties: true,
            properties: {
              bio: { bsonType: ["string", "null"] },
              timezone: { bsonType: ["string", "null"] }
            }
          }
        }
      }
    };

    if (!collectionExists(usersCollectionName)) {
      db.createCollection(usersCollectionName, {
        validator: usersValidator,
        validationLevel: "moderate",
        validationAction: "error"
      });
      print(`Created collection: ${usersCollectionName}`);
    } else {
      // Try to update validator if needed
      try {
        db.runCommand({
          collMod: usersCollectionName,
          validator: usersValidator,
          validationLevel: "moderate",
          validationAction: "error"
        });
        print(`Updated validator: ${usersCollectionName}`);
      } catch (e) {
        print(`Note: could not update validator for ${usersCollectionName}: ${e.message}`);
      }
    }

    // Unique and helpful indexes for users
    db[usersCollectionName].createIndexes([
      // Unique username (case-insensitive via collation if needed by query)
      { key: { username: 1 }, name: "ux_username", unique: true },
      { key: { email: 1 }, name: "ux_email", unique: true },
      { key: { status: 1 }, name: "ix_status" },
      { key: { createdAt: -1 }, name: "ix_createdAt_desc" },
      { key: { updatedAt: -1 }, name: "ix_updatedAt_desc" }
    ]);

    // CHANNELS COLLECTION
    // Schema overview:
    // - _id: ObjectId
    // - name: string (unique workspace-wise; for simplicity globally unique)
    // - description: string
    // - isPrivate: boolean
    // - members: array of ObjectId (user references)
    // - createdBy: ObjectId (user reference)
    // - createdAt: date
    // - updatedAt: date
    const channelsCollectionName = "channels";
    const channelsValidator = {
      $jsonSchema: {
        bsonType: "object",
        required: ["name", "isPrivate", "members", "createdBy", "createdAt", "updatedAt"],
        additionalProperties: true,
        properties: {
          _id: { bsonType: "objectId" },
          name: { bsonType: "string", description: "Unique channel identifier (e.g., slug)" },
          description: { bsonType: ["string", "null"] },
          isPrivate: { bsonType: "bool" },
          members: {
            bsonType: "array",
            items: { bsonType: "objectId" },
            description: "User IDs that are members of this channel"
          },
          createdBy: { bsonType: "objectId", description: "User ID of creator" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
          topic: { bsonType: ["string", "null"] },
          lastMessageAt: { bsonType: ["date", "null"] }
        }
      }
    };

    if (!collectionExists(channelsCollectionName)) {
      db.createCollection(channelsCollectionName, {
        validator: channelsValidator,
        validationLevel: "moderate",
        validationAction: "error"
      });
      print(`Created collection: ${channelsCollectionName}`);
    } else {
      try {
        db.runCommand({
          collMod: channelsCollectionName,
          validator: channelsValidator,
          validationLevel: "moderate",
          validationAction: "error"
        });
        print(`Updated validator: ${channelsCollectionName}`);
      } catch (e) {
        print(`Note: could not update validator for ${channelsCollectionName}: ${e.message}`);
      }
    }

    // Indexes for channels
    db[channelsCollectionName].createIndexes([
      { key: { name: 1 }, name: "ux_channel_name", unique: true },
      // Members index to query channels for a user
      { key: { members: 1 }, name: "ix_members" },
      { key: { isPrivate: 1 }, name: "ix_isPrivate" },
      { key: { lastMessageAt: -1 }, name: "ix_lastMessageAt_desc" },
      { key: { createdAt: -1 }, name: "ix_createdAt_desc" }
    ]);

    // MESSAGES COLLECTION
    // Schema overview:
    // - _id: ObjectId
    // - channelId: ObjectId (reference to channels._id)
    // - userId: ObjectId (reference to users._id)
    // - content: string (message text; allow null if attachments)
    // - attachments: array of { url, type?, size?, name? }
    // - reactions: array of { emoji, userIds: [ObjectId] }
    // - createdAt: date
    // - editedAt: date|null
    // - replyTo: ObjectId|null (message thread)
    // - deletedAt: date|null (soft delete)
    const messagesCollectionName = "messages";
    const messagesValidator = {
      $jsonSchema: {
        bsonType: "object",
        required: ["channelId", "userId", "createdAt"],
        additionalProperties: true,
        properties: {
          _id: { bsonType: "objectId" },
          channelId: { bsonType: "objectId", description: "Reference to channels._id" },
          userId: { bsonType: "objectId", description: "Reference to users._id" },
          content: { bsonType: ["string", "null"] },
          attachments: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["url"],
              properties: {
                url: { bsonType: "string" },
                type: { bsonType: ["string", "null"] },
                size: { bsonType: ["int", "long", "double", "null"] },
                name: { bsonType: ["string", "null"] }
              },
              additionalProperties: true
            }
          },
          reactions: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["emoji", "userIds"],
              properties: {
                emoji: { bsonType: "string" },
                userIds: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                }
              },
              additionalProperties: false
            }
          },
          createdAt: { bsonType: "date" },
          editedAt: { bsonType: ["date", "null"] },
          replyTo: { bsonType: ["objectId", "null"] },
          deletedAt: { bsonType: ["date", "null"] },
          // For search/scopes
          searchTokens: {
            bsonType: ["array"],
            items: { bsonType: "string" }
          }
        }
      }
    };

    if (!collectionExists(messagesCollectionName)) {
      db.createCollection(messagesCollectionName, {
        validator: messagesValidator,
        validationLevel: "moderate",
        validationAction: "error"
      });
      print(`Created collection: ${messagesCollectionName}`);
    } else {
      try {
        db.runCommand({
          collMod: messagesCollectionName,
          validator: messagesValidator,
          validationLevel: "moderate",
          validationAction: "error"
        });
        print(`Updated validator: ${messagesCollectionName}`);
      } catch (e) {
        print(`Note: could not update validator for ${messagesCollectionName}: ${e.message}`);
      }
    }

    // Indexes for messages
    db[messagesCollectionName].createIndexes([
      // Core retrieval pattern: get messages by channel sorted by createdAt
      { key: { channelId: 1, createdAt: -1, _id: -1 }, name: "ix_channel_createdAt_desc" },
      // For user-specific queries (e.g., user message history)
      { key: { userId: 1, createdAt: -1 }, name: "ix_user_createdAt_desc" },
      // Threading
      { key: { replyTo: 1, createdAt: 1 }, name: "ix_replyTo_createdAt" },
      // Soft delete filter
      { key: { deletedAt: 1 }, name: "ix_deletedAt" },
      // Basic text search fallback using tokens (application is responsible to populate tokens)
      { key: { searchTokens: 1 }, name: "ix_searchTokens" }
    ]);

    // Time-to-live (optional) example for ephemeral channels/messages
    // Uncomment to expire messages after 90 days (7776000 seconds)
    // db[messagesCollectionName].createIndex({ createdAt: 1 }, { name: "ttl_90d", expireAfterSeconds: 7776000 });

    // RELATIONSHIP NOTES (Documentation inline):
    // - messages.channelId references channels._id
    // - messages.userId references users._id
    // - channels.members is an array of users._id
    // MongoDB doesn't enforce foreign keys; ensure application layer maintains referential integrity.

    print(`Initialization complete for database: ${dbName}`);
  }

  initializeChatDatabase();
})();
