import cron from "node-cron";
import { exec } from "child_process";
import path from "path";

export function startLakehouseScheduler() {

    console.log("Lakehouse scheduler started.");

    //Runs every minute (if you want every 1 min = "* * * * *", 10 mins = "*/10 * * * *" or 1 hr = 0 * * * *)
    cron.schedule("* * * * *", () => {

        console.log("Refreshing Delta Lakehouse...");

        const ETL_PATH = path.join(
            process.cwd(),
            "lakehouse",
            "etl",
            "run_pipeline.py"
        );

        exec(`python3 "${ETL_PATH}"`, (error, stdout, stderr) => {

            if (error) {
                console.error(error);
                return;
            }

            if (stdout) {
                console.log(stdout);
            }

            if (stderr) {
                console.error(stderr);
            }
        });
    });
}