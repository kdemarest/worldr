# Copilot Coding Guidelines for Worldr

## Module Design
- Keep utility modules "pure" - they should not have domain knowledge
- Example: `LazyFile` is a generic cached file wrapper; domain-specific files use it

## Comments
- File header or class header explainers are fine
- Not every function needs a comment - the function name should explain it.
- Unexpected nuances or "policies of use" deserve big comments with "WARNING" in them

## Data Authority
- I generally prefer "single point of authority" for all data
- Copying and caching is acceptable if done carefully, and var naming clearly idnicates the non-authoritative status of, eg "dataCache".

## Code Paths and Early Exit
- I dislike early exit, if the following code will handle the case.
- For example, if array a is [], and that implies no further processing will be done, I would not choose to test for it and return. I'd let it continue, and have one and only one code path, to improve debugging and maintenance

## Running Dev Servers
- In this project, I leave the dev servers running pretty much all the time, with auto-restart, so you don't have to start them. They're already up.

## Testing
- All test scripts should live in ./tests
- They all have "test-*" as their file pattern


## Windows Shell
- If you're trying to accomplish anything in cmd.exe or powershell, strongly consider writing a js script instead and running that!
- Even inside tools, use node calls instead of CLI, when possible!

# Use /refcode/
If you are having trouble with basics, like making express work, check in the directory /refcode

refcode is NOT part of this project. It is just reference code. Do not compile or run it. Do not try to give it package files, nor run the package.json files that it contains. Just use it as refernce.