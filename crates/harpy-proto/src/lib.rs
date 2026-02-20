// Re-export generated protobuf types
pub mod harpy {
    pub mod v1 {
        include!(concat!(env!("OUT_DIR"), "/harpy.v1.rs"));
    }
}
