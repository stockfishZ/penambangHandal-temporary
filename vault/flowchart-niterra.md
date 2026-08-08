# Flowchart Sistem NiTERRA

Flowchart ini dirancang khusus untuk proposal. Alur kerja disederhanakan menjadi 4 tahap utama agar juri dapat memahami keseluruhan sistem dengan cepat.

```mermaid
graph TD
    %% Styling untuk Estetika Proposal
        classDef input fill:#f8fafc,stroke:#94a3b8,stroke-width:2px,color:#0f172a,rx:8px,ry:8px;
            classDef engine fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a,rx:8px,ry:8px;
                classDef ui fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#14532d,rx:8px,ry:8px;
                    classDef output fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#78350f,rx:8px,ry:8px;
                    
                        %% 1. Input Data
                            subgraph Inputs ["1. Input Data Mentah"]
                                    D1[Data Magnetometer]:::input
                                            D2[Sampel Geokimia]:::input
                                                    D3[Grid Geospasial & Batas Legal]:::input
                                                        end
                                                        
                                                            %% 2. Processing Engine
                                                                subgraph Engine ["2. Mesin Cerdas NiTERRA"]
                                                                        E1[Analisis Prospektivitas <br/> Machine Learning]:::engine
                                                                                E2[Skoring Kendala <br/> Spasial & Legal]:::engine
                                                                                    end
                                                                                    
                                                                                        %% 3. Interface
                                                                                            subgraph Dashboard ["3. Dashboard Interaktif"]
                                                                                                    UI1[Peta Target 2D / 3D]:::ui
                                                                                                            UI2[Ranking Target Otomatis]:::ui
                                                                                                                end
                                                                                                                
                                                                                                                    %% 4. Deliverables
                                                                                                                        subgraph Outputs ["4. Hasil & Keputusan"]
                                                                                                                                O1[Prioritas Titik Pengeboran]:::output
                                                                                                                                        O2[Generator Dokumen ESG & Perizinan]:::output
                                                                                                                                                O3[Estimasi ROI & Penghematan Biaya]:::output
                                                                                                                                                    end
                                                                                                                                                    
                                                                                                                                                        %% Connections
                                                                                                                                                            D1 & D2 --> E1
                                                                                                                                                                D3 --> E2
                                                                                                                                                                    
                                                                                                                                                                        E1 & E2 --> Dashboard
                                                                                                                                                                            
                                                                                                                                                                                Dashboard --> O1
                                                                                                                                                                                    Dashboard --> O2
                                                                                                                                                                                        Dashboard --> O3
                                                                                                                                                                                        ``````
