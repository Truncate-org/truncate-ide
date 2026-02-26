#!/bin/bash
echo "Creating MySQL user 'truncate_user' for Truncate IDE..."

sudo mysql -e "CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED BY 'Arpit12345@';"
if [ $? -eq 0 ]; then
    echo "User created (or already exists)."
else
    echo "Failed to create user. Please check your MySQL installation."
    exit 1
fi

sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';"
if [ $? -eq 0 ]; then
    echo "Privileges granted."
else
    echo "Failed to grant privileges."
    exit 1
fi

sudo mysql -e "FLUSH PRIVILEGES;"
echo "Done! You can now connect with user: root, password: Arpit12345@"
