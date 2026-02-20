fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(false)
        .build_client(false)
        .compile(&["../../proto/harpy/v1/harpy.proto"], &["../../proto"])?;
    Ok(())
}
