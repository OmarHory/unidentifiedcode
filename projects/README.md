# Projects Directory

This directory stores all projects created by users of the SpeakCode application.

Each project is stored in its own subdirectory, identified by a unique ID (UUID).

## Directory Structure

```
projects/
├── project_id_1/
│   ├── file1.js
│   ├── file2.py
│   └── ...
├── project_id_2/
│   ├── file1.js
│   ├── file2.py
│   └── ...
└── ...
```

## Notes

- This directory is shared between the backend and frontend
- The backend creates and manages the project files
- The frontend reads and displays the files

Do not manually delete or modify files in this directory while the application is running. 