import mongoose from "mongoose";
import { log } from "three/src/utils.js";

//function to connect to the mongodb database
export const connectSB = async () =>{
    try{
        mongoose.connection.on('connected',()=>console.log("Database connected"))

        await mongoose.connect(`&{process.env.MONGODB_URI}/caht-app`)
    }
    catch(error){
        console.log(error);
        
    }
}