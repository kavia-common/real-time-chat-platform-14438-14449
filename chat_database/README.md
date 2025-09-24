# Chat Database (MongoDB)

This folder contains the MongoDB setup for the real-time chat application, including collection schemas, indexes, and helper scripts.

## Collections

1. users
   - Fields:
     - _id: ObjectId
     - username: string (unique, lowercased/trimmed in app layer)
     - email: string (unique, lowercased/trimmed in app layer)
     - displayName: string
     - avatarUrl: string|null
     - status: enum ['online','offline','away','dnd'] default 'offline'
     - profile: { bio?: string, timezone?: string }
     - createdAt: Date
     - updatedAt: Date
   - Indexes:
     - ux_username (unique on username)
     - ux_email (unique on email)
     - ix_status
     - ix_createdAt_desc
     - ix_updatedAt_desc

2. channels
   - Fields:
     - _id: ObjectId
     - name: string (unique)
     - description: string|null
     - isPrivate: boolean
     - members: ObjectId[] (references users._id)
     - createdBy: ObjectId (references users._id)
     - topic: string|null
     - lastMessageAt: Date|null
     - createdAt: Date
     - updatedAt: Date
   - Indexes:
     - ux_channel_name (unique on name)
     - ix_members
     - ix_isPrivate
     - ix_lastMessageAt_desc
     - ix_createdAt_desc

3. messages
   - Fields:
     - _id: ObjectId
     - channelId: ObjectId (references channels._id)
     - userId: ObjectId (references users._id)
     - content: string|null
     - attachments: { url: string, type?: string, size?: number, name?: string }[]
     - reactions: { emoji: string, userIds: ObjectId[] }[]
     - replyTo: ObjectId|null
     - createdAt: Date
     - editedAt: Date|null
     - deletedAt: Date|null
     - searchTokens: string[] (optional app-provided tokens for simple search)
   - Indexes:
     - ix_channel_createdAt_desc (channelId, createdAt desc, _id desc)
     - ix_user_createdAt_desc (userId, createdAt desc)
     - ix_replyTo_createdAt (replyTo, createdAt)
     - ix_deletedAt
     - ix_searchTokens

Notes:
- MongoDB does not enforce foreign keys. The application must ensure referential integrity for user/channel/message relationships.
- For full-text search, consider MongoDB Atlas Search or a text index based strategy per requirements. Here we provide a simple `searchTokens` array plus index.

## Scripts

- startup.sh: Starts MongoDB locally (for dev), creates admin/app users and writes connection info.
- init/init_mongodb.js: Creates collections with JSON Schema validators and indexes. Idempotent.
- init/run_init.sh: Convenience script to run the initialization against a running MongoDB.

## Usage

1) Start MongoDB (dev convenience):
   ./startup.sh

2) Initialize collections and indexes:
   ./init/run_init.sh

Environment variables (with defaults used by scripts):
- DB_NAME (default: myapp)
- DB_USER (default: appuser)
- DB_PASSWORD (default: dbuser123)
- DB_PORT (default: 5000)

The viewer under db_visualizer/ can connect using:
  source db_visualizer/mongodb.env
  npm --prefix db_visualizer start

## Best Practices Reflected

- Time-ordered retrieval: messages indexed by (channelId, createdAt desc).
- Membership queries: channels indexed by members.
- Unique constraints: username, email, channel name.
- Presence/status support on users.
- Threading via replyTo index.
- Soft delete support via deletedAt.
- Validators (moderate) to catch malformed documents while allowing additive fields for evolution.

## Future Enhancements

- Add text index or Atlas Search for full-text across messages.
- Per-channel roles and permissions.
- Workspace/organization scoping for multi-tenant setups.
- TTL indexes for ephemeral channels (commented example inside init script).
