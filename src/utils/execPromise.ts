import {exec} from 'child_process';

export async function execPromise(...command: string[]) {
  return new Promise<string>((resolve, reject) => {
    exec(command.join(' '), (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      if (stderr) {
        return reject(new Error(stderr));
      }
      return resolve(stdout);
    });
  });
}
