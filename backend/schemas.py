from datetime import datetime

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateMeRequest(BaseModel):
    username: str
    display_name: str


class UpdateOnlineVisibilityRequest(BaseModel):
    show_online: bool


class UpdatePrivacyRequest(BaseModel):
    require_group_invite_approval: bool


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    avatar: str
    avatar_url: str | None = None
    show_online: bool = True
    require_group_invite_approval: bool = False
    is_online: bool = False
    last_seen: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CreatePrivateChatRequest(BaseModel):
    username: str


class CreateGroupChatRequest(BaseModel):
    title: str
    usernames: list[str]


class SetChatPinnedRequest(BaseModel):
    is_pinned: bool


class SetChatMutedRequest(BaseModel):
    is_muted: bool


class SetChatBlockedRequest(BaseModel):
    is_blocked: bool


class SetGroupMemberRoleRequest(BaseModel):
    role: str


class AddGroupMemberRequest(BaseModel):
    username: str


class ChatResponse(BaseModel):
    id: int
    type: str = "private"
    user_id: int
    username: str
    display_name: str
    avatar: str
    avatar_url: str | None = None
    owner_id: int | None = None
    current_user_role: str | None = None
    last_message: str | None = None
    last_message_time: datetime | None = None
    unread: int = 0
    is_pinned: bool = False
    is_muted: bool = False
    is_blocked_by_me: bool = False
    is_blocked_me: bool = False
    is_online: bool = False
    last_seen: datetime | None = None
    member_count: int = 2
    online_count: int = 0


class GroupMemberResponse(BaseModel):
    user_id: int
    username: str
    display_name: str
    avatar: str
    avatar_url: str | None = None
    role: str
    is_online: bool = False
    last_seen: datetime | None = None


class SendMessageRequest(BaseModel):
    text: str | None = ""
    media_url: str | None = None
    media_type: str | None = None
    file_name: str | None = None
    reply_to_message_id: int | None = None


class UpdateMessageRequest(BaseModel):
    text: str


class SetMessageReactionRequest(BaseModel):
    emoji: str


class SetMessagePinnedRequest(BaseModel):
    is_pinned: bool


class MessageReactionResponse(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool = False


class MessageReplyResponse(BaseModel):
    id: int
    sender_id: int
    sender_display_name: str
    text: str | None = None
    media_type: str | None = None
    file_name: str | None = None
    is_deleted: bool = False


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    reply_to_message_id: int | None = None
    reply_to: MessageReplyResponse | None = None
    text: str | None = None
    media_url: str | None = None
    media_type: str | None = None
    file_name: str | None = None
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    read_at: datetime | None = None
    from_me: bool
    is_read: bool = False
    is_deleted: bool = False
    is_system: bool = False
    system_type: str | None = None
    is_pinned: bool = False
    pinned_at: datetime | None = None
    pinned_by_id: int | None = None
    reactions: list[MessageReactionResponse] = []


class UploadResponse(BaseModel):
    file_url: str
    media_type: str
    file_name: str


class MarkReadResponse(BaseModel):
    chat_id: int
    message_ids: list[int]
    read_at: datetime


class DeleteMessageResponse(BaseModel):
    message_id: int
    chat_id: int
    scope: str


class DeleteChatResponse(BaseModel):
    chat_id: int
    scope: str


class JoinGroupInviteResponse(BaseModel):
    group_chat: ChatResponse
    invite_id: int
    status: str



class RemoveGroupMemberResponse(BaseModel):
    chat_id: int
    user_id: int
    scope: str = "removed"


class LeaveGroupResponse(BaseModel):
    chat_id: int
    user_id: int
    scope: str = "left"
