import { DashboardRepository } from "./dashboard.repository.js";

export class DashboardService {

    //Get all dashboard statistics in one call
    static async getDashboardStats(dateFilter?: string) {

        //Fetch all stats in parallel for performance
        const [
            totalPopulation,
            registeredVoters,
            gender,
            totalHouseholds,
            totalFamilies,
            ageClassification,
            pwdCount,
            employment,
            newResidents,
            movedOut,
            deceased
        ] = await Promise.all([
            DashboardRepository.getTotalPopulation(dateFilter),
            DashboardRepository.getRegisteredVoters(dateFilter),
            DashboardRepository.getGenderCount(dateFilter),
            DashboardRepository.getTotalHouseholds(dateFilter),
            DashboardRepository.getTotalFamilies(dateFilter),
            DashboardRepository.getAgeClassification(dateFilter),
            DashboardRepository.getPWDCount(dateFilter),
            DashboardRepository.getEmploymentCount(dateFilter),
            DashboardRepository.getNewResidents(),
            DashboardRepository.getMovedOutResidents(),
            DashboardRepository.getDeceasedResidents()
        ]);

        return {
            //Stat cards (matches frontend StatData array order)
            stats: {
                totalPopulation,
                registeredVoters,
                male: gender.male,
                female: gender.female,
                totalHouseholds,
                totalFamilies
            },

            //Pie chart data (matches frontend chartData array)
            classification: {
                children: ageClassification.children,
                youth: ageClassification.youth,
                seniorCitizen: ageClassification.seniorCitizen,
                pwd: pwdCount,
                employed: employment.employed,
                unemployed: employment.unemployed
            },

            //Log cards (matches frontend logData array)
            logs: {
                newResidents,
                movedOut,
                deceased
            }
        };
    }
}