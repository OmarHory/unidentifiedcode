import asyncio
import sys
import os
import uuid
from passlib.context import CryptContext

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base, AsyncSessionLocal
from app.models.user import User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_tables():
    """Create all tables in the database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully.")

async def create_test_user():
    """Create a test user with hashed password."""
    # Test user credentials
    username = "test"
    email = "test@example.com"
    password = "test"
    
    # Hash the password
    hashed_password = pwd_context.hash(password)
    
    # Create a new user
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        hashed_password=hashed_password,
        is_active=True
    )
    
    # Save the user to the database
    async with AsyncSessionLocal() as session:
        # Check if user already exists
        from sqlalchemy import select, or_
        result = await session.execute(
            select(User).where(
                or_(
                    User.username == username,
                    User.email == email
                )
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"User with username '{username}' or email '{email}' already exists.")
            return
        
        session.add(user)
        await session.commit()
        
        print(f"Test user created successfully:")
        print(f"  Username: {username}")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print(f"  User ID: {user.id}")

async def main():
    # Create tables if they don't exist
    await create_tables()
    
    # Create test user
    await create_test_user()

if __name__ == "__main__":
    asyncio.run(main())
