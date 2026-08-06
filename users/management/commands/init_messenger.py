"""
Management command to initialize required database records for Private Messenger.

Ensures the dedicated admin ChatUser record exists and optionally creates
sample friends and a Django superuser for local testing.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from chat.models import Message, MessageType
from users.models import ChatUser


class Command(BaseCommand):
    """Command to initialize Messenger system users and sample data."""

    help = "Initialize required admin ChatUser record and optional sample data."

    def add_arguments(self, parser):
        """Add command arguments."""
        parser.add_argument(
            "--sample",
            action="store_true",
            help="Create sample friend ChatUser records and conversation messages.",
        )
        parser.add_argument(
            "--superuser",
            action="store_true",
            help="Create a default Django superuser (admin / adminpass123) if none exists.",
        )

    def handle(self, *args, **options):
        """Execute the command."""
        # 1. Ensure internal admin ChatUser exists
        admin_chat_user = ChatUser.get_admin_user()
        self.stdout.write(
            self.style.SUCCESS(f"Verified admin counterpart ChatUser: {admin_chat_user.user_id}")
        )

        # 2. Optionally create default Django superuser
        '''if options["superuser"] or options["sample"]:
            django_user_model = get_user_model()
            if not django_user_model.objects.filter(username="admin").exists():
                django_user_model.objects.create_superuser(
                    username="avi49",
                    email="avi@msgadmin.com",
                    password="avipass123",
                )
                self.stdout.write(
                    self.style.SUCCESS("Created default Django superuser: admin (password: adminpass123)")
                )'''

        # 3. Optionally create sample friends and messages
        if options["sample"]:
            sample_friends = [
                ("azhar", "Azhar", "apk-key-azh-078"),
                ("puspa", "Puspa", "apk-key-pus-098"),
                ("ananya", "Ananya", "apk-key-ana-049"),
                ("meena", "Meena", "apk-key-mee-019"),
                ("aku", "Akshat", "apk-key-aku-209"),
                ("abhi", "Abhi", "apk-key-abh-256"),
            ]
            for uid, name, key in sample_friends:
                friend, created = ChatUser.objects.update_or_create(
                    user_id=uid,
                    defaults={
                        "display_name": name,
                        "api_key": key,
                        "is_active": True,
                    },
                )
                '''if created:
                    self.stdout.write(self.style.SUCCESS(f"Created friend: {name} ({uid})"))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Updated friend: {name} ({uid})"))
                    # Add a welcome sample message
                    Message.objects.create(
                        sender=friend,
                        receiver=admin_chat_user,
                        text=f"Hello Avi! This is {name} connecting from my Android APK.",
                        message_type=MessageType.TEXT,
                        delivered=True,
                    )
                    Message.objects.create(
                        sender=admin_chat_user,
                        receiver=friend,
                        text=f"Welcome {name}! Our private end-to-end channel is ready.",
                        message_type=MessageType.TEXT,
                        delivered=True,
                        seen=True,
                    )'''
            self.stdout.write(self.style.SUCCESS("Friends and messages initialized."))
