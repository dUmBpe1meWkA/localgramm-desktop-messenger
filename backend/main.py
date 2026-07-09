import json
import os
import re
import uuid
from datetime import datetime

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    get_user_from_token,
    hash_password,
    verify_password,
)
from connection_manager import manager
from database import Base, SessionLocal, engine, get_db
from models import BlockedUser, Chat, ChatMember, GroupInvite, Message, MessageHidden, MessageReaction, User
from schemas import (
    ChatResponse,
    CreatePrivateChatRequest,
    CreateGroupChatRequest,
    DeleteChatResponse,
    DeleteMessageResponse,
    LoginRequest,
    MarkReadResponse,
    MessageReactionResponse,
    MessageReplyResponse,
    MessageResponse,
    RegisterRequest,
    SendMessageRequest,
    SetChatBlockedRequest,
    SetChatMutedRequest,
    SetChatPinnedRequest,
    SetMessageReactionRequest,
    SetMessagePinnedRequest,
    TokenResponse,
    UpdateMessageRequest,
    UpdateMeRequest,
    UpdateOnlineVisibilityRequest,
    GroupMemberResponse,
    JoinGroupInviteResponse,
    RemoveGroupMemberResponse,
    LeaveGroupResponse,
    SetGroupMemberRoleRequest,
    AddGroupMemberRequest,
    UpdatePrivacyRequest,
    UploadResponse,
    UserResponse,
)


Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.environ.get("LOCALGRAMM_UPLOAD_DIR", "uploads")
MESSAGE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "messages")
AVATAR_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "avatars")

os.makedirs(MESSAGE_UPLOAD_DIR, exist_ok=True)
os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="LocalGramm API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def add_column_if_missing(table_name: str, column_name: str, column_sql: str):
    with engine.connect() as connection:
        columns = connection.exec_driver_sql(
            f"PRAGMA table_info({table_name})"
        ).fetchall()

        existing_columns = [column[1] for column in columns]

        if column_name not in existing_columns:
            connection.exec_driver_sql(
                f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"
            )
            connection.commit()


add_column_if_missing("messages", "media_url", "media_url VARCHAR(500)")
add_column_if_missing("messages", "media_type", "media_type VARCHAR(50)")
add_column_if_missing("messages", "file_name", "file_name VARCHAR(255)")
add_column_if_missing("messages", "reply_to_message_id", "reply_to_message_id INTEGER")
add_column_if_missing("messages", "edited_at", "edited_at DATETIME")
add_column_if_missing("messages", "deleted_at", "deleted_at DATETIME")
add_column_if_missing("messages", "read_at", "read_at DATETIME")
add_column_if_missing("messages", "is_system", "is_system BOOLEAN DEFAULT 0")
add_column_if_missing("messages", "system_type", "system_type VARCHAR(50)")
add_column_if_missing("messages", "is_pinned", "is_pinned BOOLEAN DEFAULT 0")
add_column_if_missing("messages", "pinned_at", "pinned_at DATETIME")
add_column_if_missing("messages", "pinned_by_id", "pinned_by_id INTEGER")

add_column_if_missing("chat_members", "is_pinned", "is_pinned BOOLEAN DEFAULT 0")
add_column_if_missing("chat_members", "is_muted", "is_muted BOOLEAN DEFAULT 0")
add_column_if_missing("chat_members", "joined_at", "joined_at DATETIME")
add_column_if_missing("chat_members", "is_hidden", "is_hidden BOOLEAN DEFAULT 0")
add_column_if_missing("chat_members", "hidden_at", "hidden_at DATETIME")
add_column_if_missing("chat_members", "role", "role VARCHAR(20) DEFAULT 'member'")
add_column_if_missing("chats", "title", "title VARCHAR(120)")
add_column_if_missing("chats", "avatar", "avatar VARCHAR(10)")
add_column_if_missing("chats", "avatar_url", "avatar_url VARCHAR(500)")
add_column_if_missing("chats", "owner_id", "owner_id INTEGER")
add_column_if_missing("users", "show_online", "show_online BOOLEAN DEFAULT 1")
add_column_if_missing("users", "last_seen", "last_seen DATETIME")
add_column_if_missing("users", "avatar_url", "avatar_url VARCHAR(500)")
add_column_if_missing("users", "require_group_invite_approval", "require_group_invite_approval BOOLEAN DEFAULT 0")


def normalize_username(username: str) -> str:
    return username.strip().replace("@", "").lower()


def get_group_avatar_letter(title: str) -> str:
    value = title.strip() or "G"
    return value[0].upper()


def make_avatar(display_name: str, username: str) -> str:
    source = display_name.strip() or username.strip()

    if not source:
        return "U"

    return source[0].upper()


def detect_avatar_extension(content_type: str) -> str:
    if content_type == "image/jpeg":
        return ".jpg"

    if content_type == "image/png":
        return ".png"

    if content_type == "image/webp":
        return ".webp"

    if content_type == "image/gif":
        return ".gif"

    raise HTTPException(status_code=400, detail="Avatar must be JPG, PNG, WebP or GIF")


def remove_avatar_file(avatar_url: str | None):
    if not avatar_url:
        return

    if not avatar_url.startswith("/uploads/avatars/"):
        return

    file_name = os.path.basename(avatar_url)
    file_path = os.path.join(AVATAR_UPLOAD_DIR, file_name)

    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError as error:
        print(f"Avatar cleanup error: {error}")


def detect_media_type(content_type: str) -> str:
    if content_type.startswith("image/"):
        return "image"

    if content_type.startswith("audio/"):
        return "voice"

    if content_type.startswith("video/"):
        return "video"

    return "file"


def make_message_preview(message: Message | None) -> str | None:
    if not message:
        return None

    if message.is_system:
        return message.text

    if message.text:
        return message.text

    if message.media_type == "sticker":
        return "Sticker"

    if message.media_type == "image":
        return "Photo"

    if message.media_type == "voice":
        return "Voice message"

    if message.media_type == "video_note":
        return "Video message"

    if message.media_type == "video":
        return "Video"

    if message.media_type == "file":
        return message.file_name or "File"

    return "Message"

def get_visible_last_message(
    db: Session,
    chat_id: int,
    current_user: User,
) -> Message | None:
    return (
        db.query(Message)
        .outerjoin(
            MessageHidden,
            and_(
                MessageHidden.message_id == Message.id,
                MessageHidden.user_id == current_user.id,
            ),
        )
        .filter(
            and_(
                Message.chat_id == chat_id,
                Message.deleted_at.is_(None),
                MessageHidden.id.is_(None),
            )
        )
        .order_by(Message.created_at.desc())
        .first()
    )



def validate_username(username: str):
    if not re.fullmatch(r"[a-z0-9_]{4,24}", username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 4-24 chars: latin letters, digits and _",
        )


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar=user.avatar,
        avatar_url=user.avatar_url,
        show_online=bool(user.show_online),
        require_group_invite_approval=bool(user.require_group_invite_approval),
    )


def message_reply_to_response(message: Message | None) -> MessageReplyResponse | None:
    if not message:
        return None

    is_deleted = message.deleted_at is not None
    sender_display_name = "User"

    if message.sender:
        sender_display_name = message.sender.display_name

    return MessageReplyResponse(
        id=message.id,
        sender_id=message.sender_id,
        sender_display_name=sender_display_name,
        text=None if is_deleted else message.text,
        media_type=None if is_deleted else message.media_type,
        file_name=None if is_deleted else message.file_name,
        is_deleted=is_deleted,
    )


def message_reactions_to_response(
    message: Message,
    current_user: User,
) -> list[MessageReactionResponse]:
    reaction_stats: dict[str, dict[str, object]] = {}

    for reaction in message.reactions:
        emoji = reaction.emoji

        if emoji not in reaction_stats:
            reaction_stats[emoji] = {
                "count": 0,
                "reacted_by_me": False,
            }

        reaction_stats[emoji]["count"] = int(reaction_stats[emoji]["count"]) + 1

        if reaction.user_id == current_user.id:
            reaction_stats[emoji]["reacted_by_me"] = True

    return [
        MessageReactionResponse(
            emoji=emoji,
            count=int(data["count"]),
            reacted_by_me=bool(data["reacted_by_me"]),
        )
        for emoji, data in sorted(
            reaction_stats.items(),
            key=lambda item: (-int(item[1]["count"]), item[0]),
        )
    ]


def create_system_message(
    db: Session,
    chat_id: int,
    actor_id: int,
    text: str,
    system_type: str,
    media_url: str | None = None,
    file_name: str | None = None,
) -> Message:
    message = Message(
        chat_id=chat_id,
        sender_id=actor_id,
        text=text,
        media_type="system",
        media_url=media_url,
        file_name=file_name,
        is_system=True,
        system_type=system_type,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    return message


async def broadcast_new_message(db: Session, message: Message):
    member_ids = get_chat_member_ids(db, message.chat_id)

    for user_id in member_ids:
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            continue

        await manager.send_to_user(
            user_id,
            {
                "type": "new_message",
                "message": jsonable_encoder(message_to_response(message, user)),
            },
        )


def get_pin_preview(message: Message) -> str:
    if message.text:
        return "a message"

    if message.media_type == "sticker":
        return "a sticker"

    if message.media_type == "image":
        return "a photo"

    if message.media_type == "voice":
        return "a voice message"

    if message.media_type == "video_note":
        return "a video message"

    if message.media_type == "video":
        return "a video"

    if message.media_type == "file":
        return message.file_name or "a file"

    return "a message"


def message_to_response(message: Message, current_user: User) -> MessageResponse:
    from_me = message.sender_id == current_user.id
    is_deleted = message.deleted_at is not None

    return MessageResponse(
        id=message.id,
        chat_id=message.chat_id,
        sender_id=message.sender_id,
        text=None if is_deleted else message.text,
        media_url=None if is_deleted else message.media_url,
        media_type=None if is_deleted else message.media_type,
        file_name=None if is_deleted else message.file_name,
        reply_to_message_id=message.reply_to_message_id,
        reply_to=message_reply_to_response(message.reply_to),
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
        read_at=message.read_at,
        from_me=from_me,
        is_read=bool(message.read_at) if from_me else True,
        is_deleted=is_deleted,
        is_system=bool(message.is_system),
        system_type=message.system_type,
        is_pinned=bool(message.is_pinned),
        pinned_at=message.pinned_at,
        pinned_by_id=message.pinned_by_id,
        reactions=[] if is_deleted or message.is_system else message_reactions_to_response(message, current_user),
    )


def find_private_chat_between_users(db: Session, user_id_1: int, user_id_2: int):
    user_1_chat_ids = (
        db.query(ChatMember.chat_id)
        .filter(ChatMember.user_id == user_id_1)
        .subquery()
    )

    user_2_chat_ids = (
        db.query(ChatMember.chat_id)
        .filter(ChatMember.user_id == user_id_2)
        .subquery()
    )

    return (
        db.query(Chat)
        .filter(Chat.type == "private")
        .filter(Chat.id.in_(user_1_chat_ids))
        .filter(Chat.id.in_(user_2_chat_ids))
        .first()
    )

def get_visible_user_status(user: User):
    if not user.show_online:
        return False, None

    return manager.is_user_online(user.id), user.last_seen


async def broadcast_user_status(user: User):
    is_online, last_seen = get_visible_user_status(user)

    await manager.broadcast(
        {
            "type": "user_status",
            "user_id": user.id,
            "is_online": is_online,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "display_name": user.display_name,
            "username": user.username,
            "avatar": user.avatar,
            "avatar_url": user.avatar_url,
        }
    )

async def broadcast_user_profile_update(user: User):
    await manager.broadcast(
        {
            "type": "user_profile_updated",
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar": user.avatar,
            "avatar_url": user.avatar_url,
        }
    )


def is_group_admin(member: ChatMember | None) -> bool:
    return bool(member and member.role in {"owner", "admin"})


def ensure_group_member(db: Session, chat_id: int, user_id: int) -> ChatMember:
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user_id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    return member


def ensure_group_admin(db: Session, chat_id: int, user_id: int) -> tuple[Chat, ChatMember]:
    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type != "group":
        raise HTTPException(status_code=400, detail="This action is only for groups")

    member = ensure_group_member(db, chat_id, user_id)

    if not is_group_admin(member):
        raise HTTPException(status_code=403, detail="Only group admins can do this")

    return chat, member


def is_user_blocked_pair(db: Session, blocker_id: int, blocked_id: int) -> bool:
    return (
        db.query(BlockedUser)
        .filter(
            and_(
                BlockedUser.blocker_id == blocker_id,
                BlockedUser.blocked_id == blocked_id,
            )
        )
        .first()
        is not None
    )


def chat_to_response(db: Session, chat: Chat, current_user: User) -> ChatResponse:
    current_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat.id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not current_member:
        raise HTTPException(status_code=404, detail="Chat member not found")

    last_message = get_visible_last_message(db, chat.id, current_user)

    if chat.type == "group":
        members = (
            db.query(ChatMember)
            .filter(ChatMember.chat_id == chat.id)
            .all()
        )
        member_count = len(members)
        online_count = sum(
            1 for member in members if manager.is_user_online(member.user_id)
        )
        title = chat.title or "Group"

        return ChatResponse(
            id=chat.id,
            type="group",
            user_id=0,
            username="",
            display_name=title,
            avatar=chat.avatar or get_group_avatar_letter(title),
            avatar_url=chat.avatar_url,
            owner_id=chat.owner_id,
            current_user_role=current_member.role or "member",
            last_message=make_message_preview(last_message),
            last_message_time=last_message.created_at if last_message else None,
            unread=0,
            is_pinned=bool(current_member.is_pinned),
            is_muted=bool(current_member.is_muted),
            is_blocked_by_me=False,
            is_blocked_me=False,
            is_online=False,
            last_seen=None,
            member_count=member_count,
            online_count=online_count,
        )

    other_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat.id,
                ChatMember.user_id != current_user.id,
            )
        )
        .first()
    )

    if not other_member:
        raise HTTPException(status_code=404, detail="Chat member not found")

    other_user = db.query(User).filter(User.id == other_member.user_id).first()

    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_blocked_by_me = is_user_blocked_pair(db, current_user.id, other_user.id)
    is_blocked_me = is_user_blocked_pair(db, other_user.id, current_user.id)

    other_is_online, other_last_seen = get_visible_user_status(other_user)

    return ChatResponse(
        id=chat.id,
        type="private",
        user_id=other_user.id,
        username=other_user.username,
        display_name=other_user.display_name,
        avatar=other_user.avatar,
        avatar_url=other_user.avatar_url,
        owner_id=None,
        current_user_role=None,
        last_message=make_message_preview(last_message),
        last_message_time=last_message.created_at if last_message else None,
        unread=0,
        is_pinned=bool(current_member.is_pinned),
        is_muted=bool(current_member.is_muted),
        is_blocked_by_me=is_blocked_by_me,
        is_blocked_me=is_blocked_me,
        is_online=other_is_online,
        last_seen=other_last_seen,
        member_count=2,
        online_count=1 if other_is_online else 0,
    )

async def broadcast_chat_update(db: Session, chat_id: int):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        return

    members = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id)
        .all()
    )

    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()

        if not user:
            continue

        await manager.send_to_users(
            [user.id],
            {
                "type": "chat_updated",
                "chat": jsonable_encoder(chat_to_response(db, chat, user)),
            },
        )


async def send_private_invite_message(
    db: Session,
    invite_message: Message,
    inviter: User,
    invitee: User,
):
    await manager.send_to_users(
        [invitee.id],
        {
            "type": "new_message",
            "message": jsonable_encoder(message_to_response(invite_message, invitee)),
        },
    )

    await manager.send_to_users(
        [inviter.id],
        {
            "type": "new_message",
            "message": jsonable_encoder(message_to_response(invite_message, inviter)),
        },
    )


@app.get("/")
def root():
    return {"message": "LocalGramm API is running"}

async def handle_websocket_message(db: Session, user: User, message_text: str):
    try:
        data = json.loads(message_text)
    except json.JSONDecodeError:
        return

    if data.get("type") != "typing_status":
        return

    chat_id = data.get("chat_id")
    status = data.get("status")

    if not isinstance(chat_id, int):
        return

    if status not in ["typing", "recording", "none"]:
        return

    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user.id,
            )
        )
        .first()
    )

    if not member:
        return

    other_members = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id != user.id,
            )
        )
        .all()
    )

    receiver_ids = [member.user_id for member in other_members]

    await manager.send_to_users(
        receiver_ids,
        {
            "type": "chat_activity",
            "chat_id": chat_id,
            "user_id": user.id,
            "status": status,
            "display_name": user.display_name,
            "username": user.username,
        },
    )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    db = SessionLocal()

    try:
        try:
            user = get_user_from_token(token, db)
        except HTTPException:
            await websocket.close(code=1008)
            return

        await manager.connect(user.id, websocket)

        user.last_seen = datetime.utcnow()
        db.commit()
        db.refresh(user)

        await broadcast_user_status(user)

        try:
            while True:
                message_text = await websocket.receive_text()
                await handle_websocket_message(db, user, message_text)

        except WebSocketDisconnect:
            manager.disconnect(user.id, websocket)

            if not manager.is_user_online(user.id):
                user.last_seen = datetime.utcnow()
                db.commit()
                db.refresh(user)

                await broadcast_user_status(user)

    finally:
        db.close()

@app.post("/auth/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    username = normalize_username(data.username)
    display_name = data.display_name.strip()
    password = data.password.strip()

    validate_username(username)

    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 chars")

    existing_user = db.query(User).filter(User.username == username).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username is already taken")

    user = User(
        username=username,
        display_name=display_name,
        password_hash=hash_password(password),
        avatar=make_avatar(display_name, username),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=user_to_response(user),
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    username = normalize_username(data.username)
    password = data.password.strip()

    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=user_to_response(user),
    )


@app.get("/users/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


@app.patch("/users/me", response_model=UserResponse)
def update_me(
    data: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    username = normalize_username(data.username)
    display_name = data.display_name.strip()

    validate_username(username)

    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")

    existing_user = (
        db.query(User)
        .filter(User.username == username, User.id != current_user.id)
        .first()
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Username is already taken")

    current_user.username = username
    current_user.display_name = display_name
    current_user.avatar = make_avatar(display_name, username)

    db.commit()
    db.refresh(current_user)

    return user_to_response(current_user)

@app.patch("/users/me/online-visibility", response_model=UserResponse)
async def update_online_visibility(
    data: UpdateOnlineVisibilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.show_online = data.show_online
    current_user.last_seen = datetime.utcnow()

    db.commit()
    db.refresh(current_user)

    await broadcast_user_status(current_user)

    return user_to_response(current_user)

@app.patch("/users/me/privacy", response_model=UserResponse)
async def update_privacy(
    data: UpdatePrivacyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.require_group_invite_approval = data.require_group_invite_approval
    current_user.last_seen = datetime.utcnow()

    db.commit()
    db.refresh(current_user)

    return user_to_response(current_user)


@app.post("/users/me/avatar", response_model=UserResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = file.content_type or ""
    extension = detect_avatar_extension(content_type)

    content = await file.read()

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar must be smaller than 5 MB")

    old_avatar_url = current_user.avatar_url

    unique_name = f"user_{current_user.id}_{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(AVATAR_UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as saved_file:
        saved_file.write(content)

    current_user.avatar_url = f"/uploads/avatars/{unique_name}"
    current_user.last_seen = datetime.utcnow()

    db.commit()
    db.refresh(current_user)

    remove_avatar_file(old_avatar_url)
    await broadcast_user_profile_update(current_user)

    return user_to_response(current_user)


@app.delete("/users/me/avatar", response_model=UserResponse)
async def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_avatar_url = current_user.avatar_url

    current_user.avatar_url = None
    current_user.last_seen = datetime.utcnow()

    db.commit()
    db.refresh(current_user)

    remove_avatar_file(old_avatar_url)
    await broadcast_user_profile_update(current_user)

    return user_to_response(current_user)


@app.post("/uploads/message", response_model=UploadResponse)
async def upload_message_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    original_name = file.filename or "file"
    safe_name = original_name.replace("\\", "_").replace("/", "_")

    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(MESSAGE_UPLOAD_DIR, unique_name)

    content = await file.read()

    with open(file_path, "wb") as saved_file:
        saved_file.write(content)

    media_type = detect_media_type(file.content_type or "")

    return UploadResponse(
        file_url=f"/uploads/messages/{unique_name}",
        media_type=media_type,
        file_name=original_name,
    )


@app.get("/users/search", response_model=UserResponse)
def search_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    username = normalize_username(username)

    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot search yourself")

    return user_to_response(user)


@app.get("/chats", response_model=list[ChatResponse])
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat_members = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.user_id == current_user.id,
                ChatMember.is_hidden == False,
            )
        )
        .all()
    )

    chats = []

    for chat_member in chat_members:
        chat = db.query(Chat).filter(Chat.id == chat_member.chat_id).first()

        if chat:
            chats.append(chat_to_response(db, chat, current_user))

    chats.sort(
        key=lambda item: (
            item.is_pinned,
            item.last_message_time or datetime.min,
        ),
        reverse=True,
    )

    return chats


@app.patch("/chats/{chat_id}/pin", response_model=ChatResponse)
def set_chat_pinned(
    chat_id: int,
    data: SetChatPinnedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    member.is_pinned = data.is_pinned

    db.commit()
    db.refresh(member)

    return chat_to_response(db, chat, current_user)

@app.patch("/chats/{chat_id}/mute", response_model=ChatResponse)
def set_chat_muted(
    chat_id: int,
    data: SetChatMutedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    member.is_muted = data.is_muted

    db.commit()
    db.refresh(member)

    return chat_to_response(db, chat, current_user)


@app.patch("/chats/{chat_id}/block", response_model=ChatResponse)
def set_chat_blocked(
    chat_id: int,
    data: SetChatBlockedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    other_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id != current_user.id,
            )
        )
        .first()
    )

    if not other_member:
        raise HTTPException(status_code=404, detail="Chat member not found")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    existing_block = (
        db.query(BlockedUser)
        .filter(
            and_(
                BlockedUser.blocker_id == current_user.id,
                BlockedUser.blocked_id == other_member.user_id,
            )
        )
        .first()
    )

    if data.is_blocked:
        if not existing_block:
            db.add(
                BlockedUser(
                    blocker_id=current_user.id,
                    blocked_id=other_member.user_id,
                )
            )
    else:
        if existing_block:
            db.delete(existing_block)

    db.commit()

    return chat_to_response(db, chat, current_user)


@app.post("/chats/private", response_model=ChatResponse)
def create_private_chat(
    data: CreatePrivateChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    username = normalize_username(data.username)

    other_user = db.query(User).filter(User.username == username).first()

    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    if other_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot create chat with yourself")

    existing_chat = find_private_chat_between_users(
        db,
        current_user.id,
        other_user.id,
    )

    if existing_chat:
        current_member = (
            db.query(ChatMember)
            .filter(
                and_(
                    ChatMember.chat_id == existing_chat.id,
                    ChatMember.user_id == current_user.id,
                )
            )
            .first()
        )

        if current_member and current_member.is_hidden:
            current_member.is_hidden = False
            current_member.hidden_at = None
            db.commit()

        return chat_to_response(db, existing_chat, current_user)

    chat = Chat(type="private")
    db.add(chat)
    db.commit()
    db.refresh(chat)

    db.add(ChatMember(chat_id=chat.id, user_id=current_user.id))
    db.add(ChatMember(chat_id=chat.id, user_id=other_user.id))
    db.commit()

    return chat_to_response(db, chat, current_user)


def ensure_private_chat_for_invite(db: Session, inviter: User, invitee: User) -> Chat:
    chat = find_private_chat_between_users(db, inviter.id, invitee.id)

    if chat:
        for user_id in (inviter.id, invitee.id):
            member = (
                db.query(ChatMember)
                .filter(
                    and_(
                        ChatMember.chat_id == chat.id,
                        ChatMember.user_id == user_id,
                    )
                )
                .first()
            )

            if member and member.is_hidden:
                member.is_hidden = False
                member.hidden_at = None

        db.commit()
        return chat

    chat = Chat(type="private")
    db.add(chat)
    db.commit()
    db.refresh(chat)

    db.add(ChatMember(chat_id=chat.id, user_id=inviter.id))
    db.add(ChatMember(chat_id=chat.id, user_id=invitee.id))
    db.commit()

    return chat


def delete_group_fully(db: Session, chat: Chat):
    message_ids = [
        message_id
        for (message_id,) in db.query(Message.id).filter(Message.chat_id == chat.id).all()
    ]

    if message_ids:
        db.query(MessageReaction).filter(MessageReaction.message_id.in_(message_ids)).delete(
            synchronize_session=False
        )
        db.query(MessageHidden).filter(MessageHidden.message_id.in_(message_ids)).delete(
            synchronize_session=False
        )

    db.query(GroupInvite).filter(GroupInvite.group_id == chat.id).delete(
        synchronize_session=False
    )
    db.query(Message).filter(Message.chat_id == chat.id).delete(
        synchronize_session=False
    )
    db.query(ChatMember).filter(ChatMember.chat_id == chat.id).delete(
        synchronize_session=False
    )
    db.delete(chat)


def create_group_invite_message(
    db: Session,
    group_chat: Chat,
    inviter: User,
    invitee: User,
) -> Message | None:
    if is_user_blocked_pair(db, invitee.id, inviter.id):
        return None

    private_chat = ensure_private_chat_for_invite(db, inviter, invitee)

    invite = (
        db.query(GroupInvite)
        .filter(
            and_(
                GroupInvite.group_id == group_chat.id,
                GroupInvite.invitee_id == invitee.id,
            )
        )
        .first()
    )

    if invite and invite.status == "pending" and invite.message_id:
        return None

    if not invite:
        invite = GroupInvite(
            group_id=group_chat.id,
            inviter_id=inviter.id,
            invitee_id=invitee.id,
            status="pending",
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)
    else:
        invite.inviter_id = inviter.id
        invite.status = "pending"
        invite.responded_at = None
        db.commit()
        db.refresh(invite)

    message = Message(
        chat_id=private_chat.id,
        sender_id=inviter.id,
        text=f'{inviter.display_name} invites you to join group "{group_chat.title or "Group"}"',
        media_type="group_invite",
        media_url=str(invite.id),
        file_name=group_chat.title or "Group",
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    invite.message_id = message.id
    db.commit()

    return message


@app.post("/chats/group", response_model=ChatResponse)
async def create_group_chat(
    data: CreateGroupChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = data.title.strip()

    if len(title) < 2:
        raise HTTPException(status_code=400, detail="Group title is too short")

    usernames = []
    seen_usernames = set()

    for raw_username in data.usernames:
        username = normalize_username(raw_username)

        if not username or username in seen_usernames:
            continue

        seen_usernames.add(username)
        usernames.append(username)

    if not usernames:
        raise HTTPException(status_code=400, detail="Add at least one member")

    users = (
        db.query(User)
        .filter(User.username.in_(usernames))
        .all()
    )

    users_by_username = {user.username: user for user in users}
    missing_usernames = [
        username for username in usernames if username not in users_by_username
    ]

    if missing_usernames:
        raise HTTPException(
            status_code=404,
            detail=f"Users not found: {', '.join(missing_usernames)}",
        )

    group_chat = Chat(
        type="group",
        title=title,
        avatar=get_group_avatar_letter(title),
        owner_id=current_user.id,
    )
    db.add(group_chat)
    db.commit()
    db.refresh(group_chat)

    db.add(
        ChatMember(
            chat_id=group_chat.id,
            user_id=current_user.id,
            role="owner",
        )
    )

    direct_member_ids = {current_user.id}
    invite_messages: list[tuple[Message, User]] = []

    for user in users:
        if user.id == current_user.id:
            continue

        if is_user_blocked_pair(db, user.id, current_user.id):
            continue

        if user.require_group_invite_approval:
            invite_message = create_group_invite_message(
                db,
                group_chat,
                current_user,
                user,
            )

            if invite_message:
                invite_messages.append((invite_message, user))

            continue

        db.add(
            ChatMember(
                chat_id=group_chat.id,
                user_id=user.id,
                role="member",
            )
        )
        direct_member_ids.add(user.id)

    db.commit()

    for invite_message, invitee in invite_messages:
        await send_private_invite_message(db, invite_message, current_user, invitee)

    await broadcast_chat_update(db, group_chat.id)

    return chat_to_response(db, group_chat, current_user)


@app.get("/chats/{chat_id}/members", response_model=list[GroupMemberResponse])
def get_group_members(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type != "group":
        raise HTTPException(status_code=400, detail="This action is only for groups")

    ensure_group_member(db, chat_id, current_user.id)

    members = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id)
        .all()
    )

    responses = []

    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()

        if not user:
            continue

        is_online, last_seen = get_visible_user_status(user)

        responses.append(
            GroupMemberResponse(
                user_id=user.id,
                username=user.username,
                display_name=user.display_name,
                avatar=user.avatar,
                avatar_url=user.avatar_url,
                role=member.role or "member",
                is_online=is_online,
                last_seen=last_seen,
            )
        )

    role_order = {"owner": 0, "admin": 1, "member": 2}

    responses.sort(
        key=lambda member: (
            role_order.get(member.role, 3),
            member.display_name.lower(),
        )
    )

    return responses


@app.post("/chats/{chat_id}/members", response_model=list[GroupMemberResponse])
async def add_group_member(
    chat_id: int,
    data: AddGroupMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat, _current_member = ensure_group_admin(db, chat_id, current_user.id)
    username = normalize_username(data.username)

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already in this group")

    existing_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user.id,
            )
        )
        .first()
    )

    if existing_member:
        raise HTTPException(status_code=400, detail="User is already in this group")

    if is_user_blocked_pair(db, user.id, current_user.id):
        # User blocked the admin: do not send anything.
        return get_group_members(chat_id, db, current_user)

    if user.require_group_invite_approval:
        invite_message = create_group_invite_message(db, chat, current_user, user)

        if invite_message:
            await send_private_invite_message(db, invite_message, current_user, user)

        return get_group_members(chat_id, db, current_user)

    db.add(
        ChatMember(
            chat_id=chat_id,
            user_id=user.id,
            role="member",
        )
    )
    db.commit()

    await broadcast_chat_update(db, chat_id)

    return get_group_members(chat_id, db, current_user)


@app.patch("/chats/{chat_id}/members/{user_id}/role", response_model=list[GroupMemberResponse])
async def set_group_member_role(
    chat_id: int,
    user_id: int,
    data: SetGroupMemberRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat, current_member = ensure_group_admin(db, chat_id, current_user.id)

    if current_member.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can assign admins")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    if data.role not in {"admin", "member"}:
        raise HTTPException(status_code=400, detail="Role must be admin or member")

    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user_id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Owner role cannot be changed")

    member.role = data.role
    db.commit()

    await broadcast_chat_update(db, chat_id)

    return get_group_members(chat_id, db, current_user)


@app.delete("/chats/{chat_id}/members/{user_id}", response_model=RemoveGroupMemberResponse)
async def remove_group_member(
    chat_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat, current_member = ensure_group_admin(db, chat_id, current_user.id)

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Use leave group instead")

    target_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user_id,
            )
        )
        .first()
    )

    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")

    if target_member.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot be removed")

    if current_member.role == "admin" and target_member.role != "member":
        raise HTTPException(status_code=403, detail="Admin can remove only members")

    target_user = db.query(User).filter(User.id == user_id).first()
    target_name = target_user.display_name if target_user else "User"

    member_ids_before = get_chat_member_ids(db, chat_id)

    db.query(GroupInvite).filter(
        and_(
            GroupInvite.group_id == chat_id,
            GroupInvite.invitee_id == user_id,
        )
    ).delete(synchronize_session=False)

    db.delete(target_member)
    db.commit()

    system_message = create_system_message(
        db,
        chat_id,
        current_user.id,
        f"{current_user.display_name} removed {target_name}",
        "member_removed",
    )
    await broadcast_new_message(db, system_message)

    await manager.send_to_users(
        [user_id],
        {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "scope": "removed",
        },
    )

    await broadcast_chat_update(db, chat_id)

    return RemoveGroupMemberResponse(chat_id=chat_id, user_id=user_id, scope="removed")


@app.post("/chats/{chat_id}/leave", response_model=LeaveGroupResponse)
async def leave_group(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type != "group":
        raise HTTPException(status_code=400, detail="This action is only for groups")

    member = ensure_group_member(db, chat_id, current_user.id)

    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot leave group before transferring ownership or deleting the group")

    db.delete(member)
    db.commit()

    system_message = create_system_message(
        db,
        chat_id,
        current_user.id,
        f"{current_user.display_name} left the group",
        "member_left",
    )
    await broadcast_new_message(db, system_message)

    await manager.send_to_users(
        [current_user.id],
        {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "scope": "left",
        },
    )

    await broadcast_chat_update(db, chat_id)

    return LeaveGroupResponse(chat_id=chat_id, user_id=current_user.id, scope="left")


@app.delete("/chats/{chat_id}/group", response_model=DeleteChatResponse)
async def delete_group(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type != "group":
        raise HTTPException(status_code=400, detail="This action is only for groups")

    member = ensure_group_member(db, chat_id, current_user.id)

    if member.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete group")

    member_ids = get_chat_member_ids(db, chat_id)

    delete_group_fully(db, chat)
    db.commit()

    await manager.send_to_users(
        member_ids,
        {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "scope": "group_deleted",
        },
    )

    return DeleteChatResponse(chat_id=chat_id, scope="group_deleted")


@app.post("/chats/{chat_id}/avatar", response_model=ChatResponse)
async def upload_group_avatar(
    chat_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat, _member = ensure_group_admin(db, chat_id, current_user.id)

    content_type = file.content_type or ""
    extension = detect_avatar_extension(content_type)
    content = await file.read()

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar must be smaller than 5 MB")

    old_avatar_url = chat.avatar_url

    unique_name = f"group_{chat.id}_{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(AVATAR_UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as saved_file:
        saved_file.write(content)

    chat.avatar_url = f"/uploads/avatars/{unique_name}"
    db.commit()
    db.refresh(chat)

    remove_avatar_file(old_avatar_url)

    member_ids = get_chat_member_ids(db, chat_id)

    await broadcast_chat_update(db, chat_id)

    return chat_to_response(db, chat, current_user)


@app.delete("/chats/{chat_id}/avatar", response_model=ChatResponse)
async def delete_group_avatar(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat, _member = ensure_group_admin(db, chat_id, current_user.id)
    old_avatar_url = chat.avatar_url

    chat.avatar_url = None
    db.commit()
    db.refresh(chat)

    remove_avatar_file(old_avatar_url)

    member_ids = get_chat_member_ids(db, chat_id)

    await broadcast_chat_update(db, chat_id)

    return chat_to_response(db, chat, current_user)


@app.post("/group-invites/{invite_id}/join", response_model=JoinGroupInviteResponse)
async def join_group_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite = db.query(GroupInvite).filter(GroupInvite.id == invite_id).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.invitee_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invite is not for you")

    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is not pending")

    group_chat = db.query(Chat).filter(Chat.id == invite.group_id).first()

    if not group_chat or group_chat.type != "group":
        raise HTTPException(status_code=404, detail="Group not found")

    existing_member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == group_chat.id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not existing_member:
        db.add(
            ChatMember(
                chat_id=group_chat.id,
                user_id=current_user.id,
                role="member",
            )
        )

    invite.status = "accepted"
    invite.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(group_chat)

    system_message = create_system_message(
        db,
        group_chat.id,
        current_user.id,
        f"{current_user.display_name} joined the group",
        "member_joined",
    )

    await broadcast_new_message(db, system_message)

    member_ids = get_chat_member_ids(db, group_chat.id)

    await broadcast_chat_update(db, group_chat.id)

    return JoinGroupInviteResponse(
        group_chat=chat_to_response(db, group_chat, current_user),
        invite_id=invite.id,
        status=invite.status,
    )


@app.get("/chats/{chat_id}/messages", response_model=list[MessageResponse])
def get_messages(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = (
        db.query(Message)
        .outerjoin(
            MessageHidden,
            and_(
                MessageHidden.message_id == Message.id,
                MessageHidden.user_id == current_user.id,
            ),
        )
        .filter(
            and_(
                Message.chat_id == chat_id,
                Message.deleted_at.is_(None),
                MessageHidden.id.is_(None),
            )
        )
        .order_by(Message.created_at.asc())
        .all()
    )

    return [message_to_response(message, current_user) for message in messages]


def ensure_message_access(db: Session, message_id: int, current_user: User) -> Message:
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == message.chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    return message


def get_chat_member_ids(db: Session, chat_id: int) -> list[int]:
    members = db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
    return [member.user_id for member in members]


ALLOWED_MESSAGE_REACTIONS = {
    "cg_0280",
    "cg_0293",
    "cg_0022",
    "cg_0017",
    "cg_0551",
}


def is_allowed_message_reaction(emoji: str) -> bool:
    return emoji in ALLOWED_MESSAGE_REACTIONS or re.fullmatch(r"cg_\d{4}", emoji) is not None


async def broadcast_message_reaction_update(db: Session, message: Message):
    member_ids = get_chat_member_ids(db, message.chat_id)

    for member_id in member_ids:
        user = db.query(User).filter(User.id == member_id).first()

        if not user:
            continue

        await manager.send_to_user(
            member_id,
            {
                "type": "message_reaction_updated",
                "message": jsonable_encoder(message_to_response(message, user)),
            },
        )


@app.post("/messages/{message_id}/reactions", response_model=MessageResponse)
async def set_message_reaction(
    message_id: int,
    data: SetMessageReactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ensure_message_access(db, message_id, current_user)

    if message.deleted_at:
        raise HTTPException(status_code=400, detail="Deleted message cannot be reacted")

    hidden_message = (
        db.query(MessageHidden)
        .filter(
            and_(
                MessageHidden.message_id == message.id,
                MessageHidden.user_id == current_user.id,
            )
        )
        .first()
    )

    if hidden_message:
        raise HTTPException(status_code=404, detail="Message not found")

    emoji = data.emoji.strip()

    if not is_allowed_message_reaction(emoji):
        raise HTTPException(status_code=400, detail="Unsupported reaction")

    existing_reaction = (
        db.query(MessageReaction)
        .filter(
            and_(
                MessageReaction.message_id == message.id,
                MessageReaction.user_id == current_user.id,
            )
        )
        .first()
    )

    if existing_reaction and existing_reaction.emoji == emoji:
        db.delete(existing_reaction)
    elif existing_reaction:
        existing_reaction.emoji = emoji
        existing_reaction.created_at = datetime.utcnow()
    else:
        db.add(
            MessageReaction(
                message_id=message.id,
                user_id=current_user.id,
                emoji=emoji,
            )
        )

    db.commit()
    db.refresh(message)
    db.expire(message, ["reactions"])

    await broadcast_message_reaction_update(db, message)

    return message_to_response(message, current_user)


@app.delete("/messages/{message_id}/reactions", response_model=MessageResponse)
async def delete_message_reaction(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ensure_message_access(db, message_id, current_user)

    existing_reaction = (
        db.query(MessageReaction)
        .filter(
            and_(
                MessageReaction.message_id == message.id,
                MessageReaction.user_id == current_user.id,
            )
        )
        .first()
    )

    if existing_reaction:
        db.delete(existing_reaction)
        db.commit()
        db.refresh(message)
        db.expire(message, ["reactions"])

    await broadcast_message_reaction_update(db, message)

    return message_to_response(message, current_user)


@app.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: int,
    data: UpdateMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ensure_message_access(db, message_id, current_user)

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can edit only your messages")

    if message.deleted_at:
        raise HTTPException(status_code=400, detail="Deleted message cannot be edited")

    if message.media_url:
        raise HTTPException(status_code=400, detail="Only text messages can be edited")

    text = data.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Message text is required")

    message.text = text
    message.edited_at = datetime.utcnow()

    db.commit()
    db.refresh(message)

    response_message = message_to_response(message, current_user)
    member_ids = get_chat_member_ids(db, message.chat_id)

    await manager.send_to_users(
        member_ids,
        {
            "type": "message_updated",
            "message": jsonable_encoder(response_message),
        },
    )

    return response_message


@app.patch("/messages/{message_id}/pin", response_model=MessageResponse)
async def set_message_pinned(
    message_id: int,
    data: SetMessagePinnedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ensure_message_access(db, message_id, current_user)

    if message.deleted_at:
        raise HTTPException(status_code=400, detail="Deleted message cannot be pinned")

    if message.is_system:
        raise HTTPException(status_code=400, detail="System messages cannot be pinned")

    chat = db.query(Chat).filter(Chat.id == message.chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type == "group":
        current_member = ensure_group_member(db, chat.id, current_user.id)

        if not is_group_admin(current_member):
            raise HTTPException(status_code=403, detail="Only group admins can pin messages")

    message.is_pinned = data.is_pinned
    message.pinned_at = datetime.utcnow() if data.is_pinned else None
    message.pinned_by_id = current_user.id if data.is_pinned else None

    db.commit()
    db.refresh(message)

    member_ids = get_chat_member_ids(db, message.chat_id)

    for user_id in member_ids:
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            continue

        await manager.send_to_user(
            user_id,
            {
                "type": "message_updated",
                "message": jsonable_encoder(message_to_response(message, user)),
            },
        )

    if data.is_pinned:
        system_message = create_system_message(
            db,
            message.chat_id,
            current_user.id,
            f"{current_user.display_name} pinned {get_pin_preview(message)}",
            "message_pinned",
            media_url=str(message.id),
            file_name=get_pin_preview(message),
        )
        await broadcast_new_message(db, system_message)

    return message_to_response(message, current_user)


@app.delete("/messages/{message_id}", response_model=DeleteMessageResponse)
async def delete_message(
    message_id: int,
    scope: str = "everyone",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ensure_message_access(db, message_id, current_user)
    chat_id = message.chat_id

    if scope not in {"me", "everyone"}:
        raise HTTPException(status_code=400, detail="Invalid delete scope")

    if scope == "me":
        hidden_message = (
            db.query(MessageHidden)
            .filter(
                and_(
                    MessageHidden.message_id == message.id,
                    MessageHidden.user_id == current_user.id,
                )
            )
            .first()
        )

        if not hidden_message:
            db.add(
                MessageHidden(
                    message_id=message.id,
                    user_id=current_user.id,
                )
            )
            db.commit()

        return DeleteMessageResponse(
            message_id=message.id,
            chat_id=chat_id,
            scope=scope,
        )

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can delete only your messages for everyone")

    member_ids = get_chat_member_ids(db, chat_id)

    db.query(Message).filter(Message.reply_to_message_id == message.id).update(
        {"reply_to_message_id": None},
        synchronize_session=False,
    )
    db.query(MessageReaction).filter(MessageReaction.message_id == message.id).delete(
        synchronize_session=False
    )
    db.query(MessageHidden).filter(MessageHidden.message_id == message.id).delete(
        synchronize_session=False
    )

    db.delete(message)
    db.commit()

    await manager.send_to_users(
        member_ids,
        {
            "type": "message_removed",
            "chat_id": chat_id,
            "message_id": message_id,
            "scope": "everyone",
        },
    )

    return DeleteMessageResponse(
        message_id=message_id,
        chat_id=chat_id,
        scope=scope,
    )



@app.delete("/chats/{chat_id}/history")
async def clear_chat_history(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    message_ids = [
        message_id
        for (message_id,) in
        db.query(Message.id)
        .outerjoin(
            MessageHidden,
            and_(
                MessageHidden.message_id == Message.id,
                MessageHidden.user_id == current_user.id,
            ),
        )
        .filter(
            and_(
                Message.chat_id == chat_id,
                Message.deleted_at.is_(None),
                MessageHidden.id.is_(None),
            )
        )
        .all()
    ]

    for message_id in message_ids:
        db.add(
            MessageHidden(
                message_id=message_id,
                user_id=current_user.id,
            )
        )

    db.commit()

    await manager.send_to_users(
        [current_user.id],
        {
            "type": "chat_updated",
            "chat": jsonable_encoder(chat_to_response(db, chat, current_user)),
        },
    )

    return {
        "chat_id": chat_id,
        "scope": "me",
        "hidden_count": len(message_ids),
    }

@app.delete("/chats/{chat_id}", response_model=DeleteChatResponse)
async def delete_chat(
    chat_id: int,
    scope: str = "me",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if scope not in {"me", "everyone"}:
        raise HTTPException(status_code=400, detail="Invalid delete scope")

    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if scope == "me":
        member.is_hidden = True
        member.hidden_at = datetime.utcnow()
        member.is_pinned = False
        db.commit()

        return DeleteChatResponse(chat_id=chat_id, scope=scope)

    if chat.type != "private":
        raise HTTPException(status_code=400, detail="Delete for both is supported only for private chats")

    member_ids = get_chat_member_ids(db, chat_id)
    message_ids = [
        message_id
        for (message_id,) in db.query(Message.id).filter(Message.chat_id == chat_id).all()
    ]

    if message_ids:
        db.query(MessageReaction).filter(MessageReaction.message_id.in_(message_ids)).delete(
            synchronize_session=False
        )
        db.query(MessageHidden).filter(MessageHidden.message_id.in_(message_ids)).delete(
            synchronize_session=False
        )

    db.query(Message).filter(Message.chat_id == chat_id).delete(
        synchronize_session=False
    )
    db.query(ChatMember).filter(ChatMember.chat_id == chat_id).delete(
        synchronize_session=False
    )
    db.delete(chat)
    db.commit()

    await manager.send_to_users(
        member_ids,
        {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "scope": "everyone",
        },
    )

    return DeleteChatResponse(chat_id=chat_id, scope=scope)


@app.post("/chats/{chat_id}/read", response_model=MarkReadResponse)
async def mark_chat_as_read(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    unread_messages = (
        db.query(Message)
        .filter(
            and_(
                Message.chat_id == chat_id,
                Message.sender_id != current_user.id,
                Message.read_at.is_(None),
                Message.deleted_at.is_(None),
            )
        )
        .all()
    )

    read_at = datetime.utcnow()

    if not unread_messages:
        return MarkReadResponse(
            chat_id=chat_id,
            message_ids=[],
            read_at=read_at,
        )

    message_ids = []
    sender_ids = set()

    for message in unread_messages:
        message.read_at = read_at
        message_ids.append(message.id)
        sender_ids.add(message.sender_id)

    db.commit()

    data = {
        "type": "messages_read",
        "chat_id": chat_id,
        "message_ids": message_ids,
        "read_at": read_at.isoformat(),
    }

    await manager.send_to_users(list(sender_ids), data)

    return MarkReadResponse(
        chat_id=chat_id,
        message_ids=message_ids,
        read_at=read_at,
    )


@app.post("/chats/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: int,
    data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = data.text.strip() if data.text else ""

    if not text and not data.media_url:
        raise HTTPException(status_code=400, detail="Message text or media is required")

    member = (
        db.query(ChatMember)
        .filter(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user.id,
            )
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.type == "private":
        other_member = (
            db.query(ChatMember)
            .filter(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id != current_user.id,
                )
            )
            .first()
        )

        if other_member:
            block_exists = (
                db.query(BlockedUser)
                .filter(
                    or_(
                        and_(
                            BlockedUser.blocker_id == current_user.id,
                            BlockedUser.blocked_id == other_member.user_id,
                        ),
                        and_(
                            BlockedUser.blocker_id == other_member.user_id,
                            BlockedUser.blocked_id == current_user.id,
                        ),
                    )
                )
                .first()
            )

            if block_exists:
                raise HTTPException(status_code=403, detail="Chat is blocked")

    reply_to_message_id = data.reply_to_message_id

    if reply_to_message_id is not None:
        reply_to_message = (
            db.query(Message)
            .filter(
                and_(
                    Message.id == reply_to_message_id,
                    Message.chat_id == chat_id,
                )
            )
            .first()
        )

        if not reply_to_message:
            raise HTTPException(status_code=404, detail="Reply message not found")

    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        reply_to_message_id=reply_to_message_id,
        text=text,
        media_url=data.media_url,
        media_type=data.media_type,
        file_name=data.file_name,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    response_message = message_to_response(message, current_user)

    chat_members = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id)
        .all()
    )

    for chat_member in chat_members:
        if chat_member.is_hidden:
            chat_member.is_hidden = False
            chat_member.hidden_at = None

    db.commit()

    member_ids = [
        chat_member.user_id
        for chat_member in chat_members
        if chat_member.user_id != current_user.id
    ]

    await manager.send_to_users(
        member_ids,
        {
            "type": "new_message",
            "message": jsonable_encoder(response_message),
        },
    )

    return response_message


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
