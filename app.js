const fs = require('fs');
const path = require('path');
const tinify = require('tinify');
const minimist = require('minimist');

// Get parameters in CLI
const paramsCLI = minimist(process.argv.slice(2), { '--': true });
const rename = paramsCLI.rename;
const dirPath = paramsCLI.dir + '\\';
const key = paramsCLI.key;

// Tinify API key
tinify.key = key; //vnJR7z8v3q5XkMld0dQZLLfgQXw8jk61

function isImage(fileName) {
    return (
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png')
    );
}

function getImage(directory) {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, { withFileTypes: true }, (err, files) => {
            if (err) {
                reject(err.message);
            } else {
                const fileNameArray = files.filter(
                    (file) => file.isFile() && isImage(file.name),
                );
                resolve(fileNameArray);
            }
        });
    });
}

function getImageSize(imagePath) {
    return Math.round(fs.statSync(imagePath).size / 1024);
}

function compressImage(index, filePath, size) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, function (err, sourceData) {
            if (err) {
                reject(err.message);
            }
            tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                if (err) {
                    reject(err.message);
                }
                const myObj = {
                    index: index,
                    path: filePath,
                    size: size,
                    data: resultData,
                };
                resolve(myObj);
            });
        });
    });
}

function convertBufferToFile(buffer) {
    fs.writeFileSync(buffer.path, buffer.data);
    const newSize = getImageSize(buffer.path);
    console.log(
        `${truncate(path.basename(buffer.path))} ${
            buffer.size
        }KB => ${newSize}KB`,
    );
}

function getPadLength(length) {
    return length.toString().length;
}

function truncate(input) {
    if (input.length > 30) {
        return input.substring(0, 27) + '...';
    }
    return input;
}

function renameImage(oldPath, newPath) {
    const ext = path.extname(oldPath);
    fs.renameSync(oldPath, newPath + ext);
}

async function main() {
    const files = await getImage(dirPath);
    const filesCompressed = [];
    let totalComplete = 0;
    const padLength = getPadLength(files.length);

    if (rename != true && rename != undefined) {
        files.forEach((file, index) => {
            const oldPath = dirPath + file.name;
            const newPath =
                dirPath +
                rename +
                (index + 1).toString().padStart(padLength, '0');
            renameImage(oldPath, newPath);
        });
        console.log('Rename successfully');
    }

    tinify.validate((err) => {
        if (err) {
            console.log(err.message);
        } else {
            const promiseArr = [];

            console.log('Starting upload photos to Tinify.\n');

            files.forEach(async (file, index) => {
                const filePath = dirPath + file.name;
                const oldSize = getImageSize(filePath);
                const compressComplete = compressImage(
                    index,
                    filePath,
                    oldSize,
                );

                promiseArr.push(compressComplete);

                compressComplete
                    .then((response) => {
                        totalComplete++;
                        console.log(
                            `Upload successfully [${totalComplete
                                .toString()
                                .padStart(padLength, '0')}/${files.length}]`,
                        );
                    })
                    .catch((err) => {
                        totalComplete++;
                        console.log('Upload fail');
                        console.log(err);
                    });
            });

            //Change to Promise.allSettled() method
            Promise.all(promiseArr).then((response) => {
                console.log('\nStarting overwrite file.\n');
                response.forEach((bf) => {
                    convertBufferToFile(bf);
                });
                console.log(
                    `\nCompress ${response.length} files successfully.`,
                );
            });
        }
    });
}

main();
