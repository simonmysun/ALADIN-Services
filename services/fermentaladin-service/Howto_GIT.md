## How to work with Git

Before starting to work on the repository, always run the following cmd:

### Getting new code from GitHub

```sh
git pull
```

Submitt your changes to version control frequently and in small chunks with the following commands.

### Updating code

Stage your changes. `.` adds every file with a change. By naming the file-paths individual files can be staged.

```sh
git add .
```

Write a concise commit message for the changes you have made. Ideally commit are small and only change one thing. A "thing" may be multiple lines of code in multiple files but contributes to the same feature, bug-fix, etc. [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) provides a commonly used framework on how to write commit messages.

```sh
git commit -m ""
```

After you have commited your changes locally, you can submit them to the shared version control (Github), so others can see your changes.

```sh
git push
```